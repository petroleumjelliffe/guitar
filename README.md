# Loop Lesson

A web app for practising guitar along with YouTube lessons.

Paste a YouTube link, carve the video into named sections, and loop any
section at reduced speed. Sections double as custom chapters, so you can
jump straight back to "solo bars 5–8" instead of scrubbing for it. Pitch
stays correct when slowed because YouTube's player handles that.

Hands stay on the guitar: every action has a hotkey, and a Bluetooth
page-turner pedal can send the same keys.

## Features (v1)

- Named, loopable sections with a per-section speed (0.25×–2×, in
  0.05× steps between 0.75× and 1×)
- Optional pause between loop repeats so you can reset your hand
- ±0.1 s nudging of section start and end
- Frame stepping while paused (`,` / `.`) to watch fingering closely
- Mirror (`M`) and rotate-180 (`R`) so the instructor's guitar matches
  your view of your own
- Library saved in the browser, plus a shareable link per lesson that
  carries its sections

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
| `M` / `R` | Mirror / rotate 180° |
| `Delete` | Delete selected section (undo offered) |

## Non-goals (v1)

- Pitch shifting independent of speed. The embedded player can't do
  it; a browser extension could, later.
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
```

Static site: no backend, no login. Deployable to any static host.

## Docs

- `docs/superpowers/specs/` — design specs
- `docs/superpowers/plans/` — implementation plans
