# Spec: Multi-source playback for Loop Lesson (Apple Music + YouTube)

## Context

Loop Lesson (petroleumjelliffe.github.io/guitar) is a static site on GitHub Pages. It plays YouTube videos through the YouTube IFrame API and lets the user define loops (start/end points) to practice guitar parts, with speed control.

Goal: add Apple Music as a second playback source via MusicKit on the Web (MusicKit JS v3), without regressing YouTube. Do this by putting a player adapter layer between the loop UI and the playback backends.

Verified already: on music.apple.com (which runs MusicKit JS), setting playback rate from the console slows full DRM tracks with pitch preserved. So seek, position, and rate are all achievable.

## Before writing code

1. Read the existing codebase and summarize: framework or vanilla, build step or none, how the YouTube player is created, where loop logic lives, how loops are persisted (localStorage, URL, file).
2. List every place the code calls the YouTube player directly (`seekTo`, `getCurrentTime`, `setPlaybackRate`, `playVideo`, state change handlers, etc).
3. Propose a file layout for the adapter layer that matches the existing conventions, then proceed. Do not introduce a framework or build step if the project has none.

## Goals

- Loop UI talks only to a `PlayerAdapter` interface, never to YouTube or MusicKit directly.
- Existing YouTube behavior is unchanged after the refactor.
- A user with an Apple Music subscription can sign in, load a song, set loops, and change speed.
- Saved loops record which source they belong to.

## Non-goals

- Spotify support (no rate control, not worth it now). Keep the adapter design open to it.
- Any backend or server. The site stays fully static.
- Audio analysis, EQ, stem isolation, or pitch shifting. DRM audio is not accessible to Web Audio.
- Synchronized tabs or chord charts timed to Apple Music playback. The Apple developer license (3.3.6(D)) restricts synchronizing MusicKit content with other content, so keep this out of scope.
- Library and playlist browsing beyond simple catalog search (P1 at most).

## Phase 1: Adapter interface and YouTube refactor

Define the interface (JSDoc or TypeScript, matching the project):

```js
/**
 * @typedef {Object} PlayerAdapter
 * @property {string} source                    // 'youtube' | 'applemusic'
 * @property {(id: string) => Promise<void>} load
 * @property {() => Promise<void>} play
 * @property {() => Promise<void>} pause
 * @property {(seconds: number) => Promise<void>} seek
 * @property {() => number} getPosition         // seconds, float
 * @property {() => number} getDuration         // seconds
 * @property {(rate: number) => void} setRate
 * @property {() => number[]} getSupportedRates // or {min, max, step}
 * @property {() => boolean} isPlaying
 * @property {(cb: (pos: number) => void) => () => void} onTimeUpdate   // returns unsubscribe
 * @property {(cb: (state: 'playing'|'paused'|'ended'|'loading'|'error') => void) => () => void} onStateChange
 * @property {() => void} destroy
 */
```

Requirements:

- Wrap the current YouTube code in a `YouTubeAdapter` implementing this interface.
- Move loop enforcement into a source agnostic module: a single high frequency tick (requestAnimationFrame or a 50ms interval) reads `adapter.getPosition()` and calls `adapter.seek(loop.start)` when position passes `loop.end`. Do not rely on backend time events for loop accuracy.
- `getPosition()` must be smooth. If a backend reports position infrequently, the adapter interpolates from the last known position using `performance.now()` and the current rate, and resyncs on each real update.
- Speed UI reads `getSupportedRates()` and adapts.

Acceptance:

- [ ] All existing YouTube features work identically.
- [ ] No direct YouTube API calls remain outside `YouTubeAdapter`.

## Phase 2: Apple Music adapter

### Setup

- Load `https://js-cdn.music.apple.com/musickit/v3/musickit.js` lazily, only when the user picks Apple Music.
- Wait for the `musickitloaded` event, then:

```js
await MusicKit.configure({
  developerToken: APPLE_MUSIC_DEVELOPER_TOKEN,
  app: { name: 'Loop Lesson', build: '1.0.0' },
});
const music = MusicKit.getInstance();
```

- The developer token lives in a single config file (for example `config.js`) as a plain string constant. It is a public, client side token by design. Use a placeholder until the real token is supplied, and fail gracefully with a clear message if it is missing or expired (401/403 from MusicKit).

### Token generation script

- Add `scripts/generate-apple-token.mjs` (Node, run locally, never deployed logic that touches the key).
- Inputs via env vars or CLI args: Team ID, Key ID, path to the `.p8` private key.
- Output: ES256 JWT with `iss` = Team ID, `iat` = now, `exp` = now + 180 days max, header `kid` = Key ID. Optionally include `origin` claim restricted to `https://petroleumjelliffe.github.io`.
- Writes the token into the config file or prints it.
- Add `*.p8` and any key paths to `.gitignore`. The private key must never be committed. Document the regeneration steps and the expiry date in the README.

### Auth

- "Sign in to Apple Music" button calls `music.authorize()`. Must be triggered by a user gesture (popup).
- Show signed in state and a sign out option (`music.unauthorize()`).
- If not authorized or no subscription, playback falls back to 30 second previews. Detect this (duration near 30s, or `music.isAuthorized` false) and show a notice that loops need a signed in subscriber.

### Playback mapping

| Adapter method | MusicKit |
|---|---|
| `load(id)` | `music.setQueue({ song: id })` (catalog song ID) |
| `play` / `pause` | `music.play()` / `music.pause()` |
| `seek(s)` | `music.seekToTime(s)` |
| `getPosition()` | `music.currentPlaybackTime`, interpolated between `playbackTimeDidChange` events |
| `getDuration()` | `music.currentPlaybackDuration` |
| `setRate(r)` | see below |
| state | `playbackStateDidChange` mapped to adapter states |

### Playback rate

- First choice: `music.playbackRate = r`.
- Fallback: set `playbackRate` on the underlying media element MusicKit creates (`document.querySelector('audio')`, scoped as tightly as possible), with `preservesPitch = true`.
- After every `load`, and after `seek` if needed, verify the effective rate and reapply it, since MusicKit may recreate or reset the element.
- Determine the usable range empirically (test 1.0 down to 0.25) and expose it through `getSupportedRates()`. Note in a comment which mechanism ended up working.

### Song selection

- P0: paste an Apple Music song URL or ID. Parse the song ID from URLs like `https://music.apple.com/us/album/name/ALBUM_ID?i=SONG_ID` (the `i` param) and `.../song/name/SONG_ID`.
- P1: catalog search box using `music.api.music('/v1/catalog/{storefront}/search', { term, types: 'songs', limit: 10 })`, showing title, artist, artwork.

## Phase 3: Data model and UI

- Saved items become `{ source: 'youtube' | 'applemusic', id, title, artist?, loops: [{ name, start, end, rate? }] }`.
- Migrate existing saved data: anything without `source` is `youtube`. Migration must be idempotent and lossless.
- Source picker in the "add song" flow. The loop UI itself should look and behave the same for both sources.
- For Apple Music there is no video. Show artwork (from the media item's `artwork.url` with width/height substituted) in the space the video occupies.

## Edge cases to handle

- Autoplay policy: first `play()` must follow a user gesture. Surface a play button instead of failing silently.
- iOS Safari: MusicKit JS cannot continue playback in the background or when locked. Acceptable, but do not break state when the tab returns (listen for `visibilitychange` and resync).
- Seeking near the end of a track, loop end beyond duration, loop shorter than ~0.3s: clamp and guard against seek storms (debounce so at most one seek is in flight).
- Browser lacks DRM support (some privacy browsers, webviews): catch the MusicKit error and show a plain message.
- Token expired: clear message pointing to the regeneration script.
- Switching sources mid session: `destroy()` the old adapter, stop its tick, release listeners.

## Acceptance criteria

- [ ] YouTube songs and existing saved loops work exactly as before.
- [ ] With a valid token and subscription: sign in, paste an Apple Music URL, full track plays.
- [ ] A 4 second loop on an Apple Music track repeats with no more than ~150ms overshoot at 1.0x.
- [ ] Speed control slows Apple Music playback with pitch preserved, and survives track reload and seek.
- [ ] Signed out users get previews plus a clear notice, no errors in console.
- [ ] No private key material in the repo. `.gitignore` covers `.p8`.
- [ ] README documents: Apple developer setup (Media ID, MusicKit key), token generation, expiry, and the adapter interface for adding future sources.

## Open questions (resolve during implementation, note answers in README)

- Does `music.playbackRate` work directly, or only the media element fallback? (Test both, prefer the official one.)
- What is the practical minimum rate before audio quality or the browser's muting threshold makes it unusable, per browser (Safari, Chrome, Firefox)?
- How often does `playbackTimeDidChange` fire, and is interpolation needed for the accuracy target?

## Working agreements

- Commit Phase 1 on its own before starting Phase 2, so the refactor can be verified in isolation.
- Until the real developer token exists, build Phase 2 against the placeholder and make sure everything Apple related degrades gracefully.
- Keep dependencies minimal. The token script may use `jsonwebtoken` or Node's built in `crypto`. The site itself should need nothing new.