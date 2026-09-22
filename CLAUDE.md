# Loop Lesson — working notes for Claude

Static single-page app: Vite + TypeScript + Preact + `@preact/signals`,
Vitest. No backend. Deployed to GitHub Pages from `main` by
`.github/workflows/pages.yml`. Video plays through the official YouTube
IFrame Player API in an iframe; we never touch the media stream.

Status: alpha ("v0"). Nothing shared; formats may change freely.

## Layout

```
src/
  player/    wraps the YouTube IFrame API behind PlayerPort (+ FakePlayer)
  loop/      loop engine: pure logic, driven by a 50 ms tick, no DOM
  lesson/    data model, URL encode/decode, browser-storage library, tap tempo
  audio/     ClickerPort + WebAudioClicker (count-in clicks); only file that touches Web Audio
  commands/  every user action, one place; hotkeys/pedal/buttons call these
  state/     signals store (createStore)
  ui/        Preact components; render from the store, call commands
  ui/arrange/  pure lane math (snapping, follow, ruler ticks) + UI-only signals
  app.ts     the only place singletons are created
spikes/      throwaway browser probes (not part of the app)
design/      Claude Design wireframe exports
```

Only `player/youtube.ts` may reference the YouTube API (`YT`). Only
`audio/webAudio.ts` may reference Web Audio. `loop/`, `lesson/` and
`state/` stay browser-free so they are unit-tested with fakes.

## Rules

- TDD for `loop/`, `lesson/` and `commands/`: write the failing test
  first; run the focused file while iterating, the full suite before
  committing.
- Every user action is a command in `commands/`. Never bind a hotkey
  or button directly to the player, engine or lesson.
- Every lesson mutation goes through `updateLesson` (hash + debounced
  save + engine sync). Never set `store.activeSectionId` directly; the
  engine's `onChange` does that.
- Hide YouTube's native controls and keep the click-catching overlay;
  without it, the iframe steals keyboard focus and hotkeys die.
- Never auto-focus a text input after a hotkey: it would swallow the
  next hotkeys as typing and break the pedal flow. The one exception is
  the name field right after END (the video is paused then).
- Focus and hotkeys: `focusSwallows` in `commands/hotkeys.ts` decides.
  Only text-type inputs, textareas and contentEditable swallow keys;
  range/checkbox/radio inputs never trap hotkeys; a button, link or
  `role=button/radio` keeps `Space`/`Enter` only while it has
  `:focus-visible` (snapshotted at `focusin` — Chromium flips the flag
  during keydown). Anything with `role=button` must handle Space itself
  and `preventDefault` it.
- Colours live only as tokens in `:root` (`app.css`); no literals
  elsewhere, including `.tsx`. Contrast target ≥ 4.5:1 for text.
- CSS cascade trap: rules inside `@media (max-width: 719px)` lose to an
  equally specific unconditional rule declared later in the file. Put
  new component rules above the media query, or prefix the narrow rule
  with an ancestor (`.strip .key.count`, `.title-bar .bar-key`).
- Preact sets SVG attributes case-sensitively: write `tabindex`, not
  `tabIndex`, on `<svg>`.
- View mode (normal/mirror/rotate) is view-only state. Never persist it
  or put it in the share URL.
- Alpha: share-URL and storage formats may change freely (no
  migrations) until the user declares a release; keep the `v` field.
- Commit messages end with
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Known constraints (verified in `spikes/`)

- Playback rates: `getAvailablePlaybackRates()` reports only the 8
  fixed steps, but `setPlaybackRate()` honours intermediate values
  (0.85, 0.9 verified). `availableRates()` is the union of
  `DEFAULT_RATES` and the reported list.
- No time-update event: the loop engine polls `getCurrentTime()`.
  Measured overshoot at a section end: 5–50 ms at 50 ms polling.
- No frame-step API and no frame-rate info: frame step = seek ±1/30 s
  (~250 ms latency, no spinner).
- Player error 150 also fires for YouTube's "confirm you're not a bot"
  gate (VPN exit IPs, localhost); it is not always "embedding disabled".
- The app cannot hear the video (cross-origin iframe): no BPM
  detection, no pitch shift. Tempo comes from tap tempo.

## Docs

- Specs: `docs/superpowers/specs/` — v1 (`2026-09-18-loop-lesson-design.md`),
  metronome count-in (`2026-09-20-metronome-count-in-design.md`),
  arrange-view UI (`2026-09-20-arrange-view-ui-design.md`),
  multi-source playback (`multi-source.md`, user-authored; reconciliation
  spec pending).
- Plans: `docs/superpowers/plans/`.
- Build order agreed: metronome → arrange-view UI → multi-source.
  Metronome and arrange-view UI are merged (2026-09-22); multi-source
  needs a reconciliation spec next.
- `design/wireframes/` holds the Claude Design export; wireframe 3a is
  the shipped desktop layout (plus the title bar, spec §5.10).
- Read the relevant spec before changing behaviour; later specs
  supersede v1 where they conflict.
