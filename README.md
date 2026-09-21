# Loop Lesson

A web app for practising guitar along with YouTube lessons.

Paste a YouTube link, carve the video into named sections, and loop any
section at reduced speed. Sections double as custom chapters, so you can
jump straight back to "solo bars 5–8" instead of scrubbing for it. Pitch
stays correct when slowed because YouTube's player handles that.

Hands stay on the guitar: every action has a hotkey, and a Bluetooth
page-turner pedal can send the same keys.

Live: https://petroleumjelliffe.github.io/guitar/ — alpha; saved lessons
live in your browser and may be lost when formats change.

## Features

- Named, loopable sections with a per-section speed (0.25×–2×, in
  0.05× steps between 0.75× and 1×)
- Optional pause between loop repeats so you can reset your hand
- ±0.1 s nudging of section start and end
- Frame stepping while paused (`,` / `.`) to watch fingering closely
- View modes — normal, mirror (`M`), rotate 180° (`R`) — so the
  instructor's guitar matches your view of your own
- Library saved in the browser, plus a shareable link per lesson that
  carries its sections

Coming next (specs in `docs/superpowers/specs/`): tap tempo with a
click-track count-in before each loop restart; a DAW-style arrange view;
Apple Music as a second source.

## Hotkeys

| Key | Action |
|---|---|
| `Space` | Play / pause |
| `Enter`, `PageUp`, `↑` | Restart section (pedal left) |
| `PageDown`, `↓` | Next section (pedal right) |
| `L` | Toggle loop |
| `1`–`9` | Jump to section |
| `←` / `→` | Seek −3 s / +3 s |
| `Shift+←/→` | Nudge section start ∓0.1 s |
| `Alt+←/→` | Nudge section end ∓0.1 s |
| `,` / `.` | Step one frame (paused) |
| `-` / `=` | Speed down / up |
| `[` / `]` | Mark start / mark end |
| `G` | Cycle gap 0 → 1 → 2 → 3 s |
| `M` / `R` | Mirror / rotate 180° (press again for normal) |
| `Delete` | Delete selected section (undo offered) |

Hotkeys are ignored while typing in a text field.

## If a video won't play

The player shows YouTube's error code. **101/150** means YouTube
refused the embed: either the owner disabled embedding, or YouTube is
showing its "confirm you're not a bot" gate — turn off any VPN, sign in
to youtube.com in another tab, then reload. **100** is a removed or
private video; **2** an invalid ID.

## Non-goals

- Pitch shifting independent of speed, or any audio analysis. The
  embedded player never exposes its audio; a browser extension could,
  later.
- Accounts or cross-device sync. The shareable link covers moving a
  lesson between devices.
- Downloading video. Everything plays through the official YouTube
  player.

## Development

```sh
npm install
npm run dev      # local server
npm test         # unit tests
npm run build    # static site in dist/
npm run preview  # serve dist/
```

`spikes/index.html` (served by the dev server at `/spikes/`) is a
throwaway probe of the YouTube embed's behaviour; its findings are
recorded in the v1 spec.

## Deploying

Pushes to `main` run tests, build, and deploy to GitHub Pages via
`.github/workflows/pages.yml`. One-time setup: repo Settings → Pages →
Source: **GitHub Actions**.

## Docs

- `docs/superpowers/specs/` — design specs (v1, metronome count-in,
  arrange-view UI, multi-source playback)
- `docs/superpowers/plans/` — implementation plans
- `design/wireframes/` — Claude Design wireframe exports
- `CLAUDE.md` — working notes and rules for AI-assisted changes
