# Arrange-view UI — design

Date: 2026-09-20
Status: approved 2026-09-20 (§9 decisions confirmed, §10 answered);
amended 2026-09-21 for global speed (§2, §5.5, §6) and the designer's
"Section Recording Flow" (§5.9). Derived from the Claude Design project
"Loop Lesson Wireframes" — `Loop Lesson Wireframes.dc.html` (turns 1–3,
copy in `design/wireframes/`) and `Section Recording Flow.dc.html`
(three-step MARK → END → name flow). Target: option **3a** (arrange view, LCD speed gauge) on
desktop; option **1e** (stacked, chunky) under 720 px. Option 2a's
horizontal speed fader is the superseded alternative.

Alpha: no compatibility constraints. This spec assumes the metronome
count-in spec (`2026-09-20-metronome-count-in-design.md`) lands first
or alongside: the TEMPO readout and COUNT IN button are that feature's
controls.

## 1. Goal

Turn the current stacked button rows into a DAW-style practice surface:
video and section list side by side, a dark transport strip with LCD
readouts under them, and an **arrange lane** where sections are blocks
on a zoomable timeline that can be recorded, grabbed and retimed. Hands
on the guitar still drive everything by hotkey; the mouse gets a
faster path for editing.

## 2. What changes, what stays

| Area | Now | After |
|---|---|---|
| Layout | Video, then rows of buttons, then list + editor | Video + sections panel side by side; transport strip; arrange lane |
| Theme | Dark (#111) everywhere | Warm light chrome (#d8d5cf / #f6f5f2) with a dark transport strip and green-on-black LCDs |
| Speed | 12 buttons, persisted per section | Circular gauge in the LCD block, 0.25–2.00 in 0.05 steps, drag/scroll; `-`/`=` step 0.05. **Global and session-only** (decided 2026-09-21): `Section.rate` is removed, speed lives in the player and resets to 1× when a lesson opens |
| Marking | `+ mark start` / `+ mark end` | **MARK** (armed while playing) starts a section at the playhead; the block grows; **END** closes it, pauses, arms the loop and focuses the name (§5.9). `[`/`]` unchanged |
| Editing edges | ±0.1 buttons in an editor panel | In/Out edge selector + ◀ ▶ nudges beside the lane, plus dragging the block's edge with snapping |
| Timeline | Full-length bar | Zoomable lane with ruler; zoom slider, scroll to pan |
| Section list | Rows with Edit toggle | Rows: name · duration; double-click renames inline; `+` in the header (delete via `Delete` key or the lane's context) |
| Gap | 0/1/2/3 s buttons | COUNT IN button (off / 1 bar / 2 bars); seconds gap no longer in the UI (see §9) |
| Loop / restart / play | Text buttons | Icon buttons in the transport group |
| Mirror / rotate, frame step, share, library | Buttons in rows | Overlay pill in the video's bottom corner (§5.7) |
| Engine, commands, data | — | Unchanged except: continuous rate list, tap/count-in from the metronome spec |

Out of scope (present in earlier wireframes, not in 3a): rep counters
("LOOP 2/3", REPS), a VOLUME slider, a PRACTICE tab, drag-to-reorder
sections (sections stay ordered by start time — see §10).

## 3. Layout

### Desktop (≥ 720 px)

```
┌ card (max 1160, warm grey #d8d5cf, 14 px padding) ───────────────────┐
│ ┌ video 16:9 (≈48%) ───────┐ ┌ SECTIONS panel (flex 1) ────────────┐ │
│ │                          │ │ header: SECTIONS        [+] [−]      │ │
│ │                          │ │ ⠿ Section 1   5:09.9 – 5:17.1   ×1  │ │
│ │                          │ │ ⠿ Section 3 ▌ 5:36.1 – 5:44.3   ×1  │ │ ← selected (gold)
│ │                          │ │ …                                    │ │
│ └──────────────────────────┘ │ footer hint                          │ │
│                              └──────────────────────────────────────┘ │
│ ┌ transport strip (dark) ──────────────────────────────────────────┐ │
│ │ TRANSPORT ⏮ ▶ ⟳ [■ END]   COUNT IN [2 bars]   ┌LCD──────────────┐│ │
│ │                                                │POS 05:38.42 │ SPEED ◔ 0.80x │ TEMPO 96 BPM││ │
│ │──────────────────────────────────────────────────────────────────│ │
│ │ EDIT EDGE [In|Out] ◀ ▶ ±0.10s [5:44.30]         50s view −[══]+ │ │
│ │ ruler   5:20      5:30      5:40      5:50      6:00             │ │
│ │ lane   [Sec 2 ][  Sec 3  ▌]   [Sec 4 ] [Recording…]│             │ │
│ └──────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

The card is centred, max 1160 px, fluid below that. The video column
is `min(560px, 48%)`; the sections panel takes the rest and matches
the video's height (its list scrolls). The transport strip is
full-width.

### Narrow (< 720 px) — from 1e

Stacked, in order: video · thin section strip (the lane without
ruler/zoom, 22 px, tap a block to jump) · transport block (one row of
four 44 px-tall buttons ⏮ ▶ ⟳ END centred; a row with the speed gauge
and readout; COUNT IN and the utility cluster wrap beneath) · sections
list (numbered circles, name, duration). Edge editing on narrow
screens is via the In/Out selector and ◀ ▶ only (no drag), shown as a
row above the list when a section is selected.

## 4. Visual language

Tokens (CSS custom properties; replace the current `:root` set):

| Token | Value | Use |
|---|---|---|
| `--chrome` | `#d8d5cf` | page/card background |
| `--panel` | `#f6f5f2` | sections panel |
| `--panel-head` | `linear-gradient(#efeeea,#e2e0db)` | panel header |
| `--ink` | `#25251f` | panel text |
| `--muted` | `#8a877f` | secondary text |
| `--strip` | `linear-gradient(#3a3a3c,#2a2a2c)` | transport strip |
| `--strip-line` | `#1e1e20` | strip dividers |
| `--key` | `linear-gradient(#55555a,#3d3d42)`, border `#232326` | neutral buttons |
| `--key-ink` | `#e8e6e1` | icon colour on neutral buttons |
| `--lcd-bg` | `#0c1512`, border `#19211d` | LCD block |
| `--lcd` | `#7fe0b0` | LCD digits |
| `--lcd-dim` | `#4e8f70` / labels `#3e7a5f` | LCD units and labels |
| `--play` | `linear-gradient(#7fd3a4,#3fa873)`, border `#1e5b3c`, glow `rgba(80,220,150,.35)` | play button (lit while playing) |
| `--rec` | `linear-gradient(#e8705f,#c0402f)`, border `#6e1d14`, glow `rgba(230,90,70,.35)` | Record/END |
| `--count` | `linear-gradient(#8ecbff,#3f86c4)`, border `#1d4a6e` | COUNT IN |
| `--gold` | `linear-gradient(#f0c35c,#dda92f)`, ink `#33260a`, glow `rgba(240,200,90,.35)` | selected section (lane), Out edge chip, selected row (`#ffe9ad→#ffdf8f`, bar `#d99b12`) |
| `--block` | `linear-gradient(#4c86b5,#35688f)`, border `#7fb4dc`, ink `#eaf4fb` | section blocks |
| `--recording` | `repeating-linear-gradient(135deg,#b8432f 0 6px,#a13a29 6px 12px)`, dashed `#ff9f8c` | block being recorded |
| `--lane` | `repeating-linear-gradient(90deg,#1c1c1f 0 19px,#212124 19px 20px)` | lane background |
| `--playhead` | `#fff` with `0 0 6px rgba(255,255,255,.5)` | playhead |

Type: **Space Grotesk** (400/500/600) for labels and names; the
system monospace stack (`ui-monospace, Menlo, monospace`) for times,
rates, BPM and LCDs. Tiny letter-spaced caps (8 px, `.14em`) for group
labels — at narrow widths bump to 10 px. Google Fonts is loaded from
`index.html` with `preconnect`; fall back to `system-ui` if it fails.

Buttons in the strip are 30 px tall (34–74 wide), 5 px radius, 1 px
inset highlight; the mobile row uses 44 px. Row hit areas in the
sections panel are ≥ 36 px. Dark mode is not in the wireframes and is
out of scope.

## 5. Components and behaviour

Every action still goes through `commands`. New UI-only state
(zoom/pan, edit-edge, drag) lives in the components or a small
`ui/arrange` store, never in the lesson.

### 5.1 Sections panel

- Header `SECTIONS` with `+` (= `commands.markStart()`, same as MARK;
  disabled when not playing). No `−`: delete is the `Delete` key on the
  selected section (undo notice as now).
- Row: name · duration (`7.2s`, tenths). No range, no rate (speed is
  global). Click a row → `jumpToSectionId`. The active section's row is
  gold with the left bar; a selected-but-inactive row uses the same
  gold at 60 % opacity. While recording, a provisional last row reads
  `● Recording…  4.2s` in the red tint (`#fdece8`, bar `#c0402f`).
- Double-click the name (or the section's region in the lane) → inline
  `<input>` (Enter/blur commits via `renameSection`, Escape reverts).
  Hotkeys are already suppressed while it has focus. The same input is
  focused automatically after END (§5.9).
- Footer hint: "Double-click to rename · click to jump".
- Numbers: rows are numbered 1–9 in the narrow layout only (matches
  the `1`–`9` hotkeys); desktop rows omit the number.

### 5.2 Transport group

| Button | Command | Lit state |
|---|---|---|
| ⏮ | `restartSection` | — |
| ▶ / ❚❚ | `togglePlay` | green glow while `playerState === 'playing'` |
| ⟳ | `toggleLoop` | gold while `looping`; pulses (opacity 0.6↔1, 0.5 s) while `inGap` |
| ● **MARK** / ■ **END** | `markStart` / `markEnd` | One button. Idle: dark red-brown key (`#5e4240→#4a3230`, ink `#e7c9c5`, red dot) reading MARK, **enabled only while playing**. Recording: `--rec` red, glowing, reading END; works playing or paused. The ⟳ loop button is disabled (45 % opacity) while recording. |

### 5.3 COUNT IN

One button cycling `off → 1 bar → 2 bars → off` via
`commands.setCountIn`. Label shows the current value. Tooltip: "G".
When the lesson has no tempo the button is drawn at 50 % opacity with
tooltip "Tap a tempo first (T)". Tempo is per lesson (2026-09-21).

### 5.4 LCD block

Three cells separated by 1 px dividers on `--lcd-bg`:

- **POSITION** — `mm:ss.t` of `currentTime` (tenths, `formatTime`).
  The wireframe shows hundredths; tenths match the engine's accuracy.
  Frame-accurate display is not possible: the IFrame API does not
  report the video's frame rate. Updated every tick.
- **SPEED** — the gauge (§5.5) plus `0.80 x`.
- **TEMPO** — `96 BPM`, or `TAP` when the lesson's bpm is 0, or
  `tap ×N` while converging. The whole cell is a button:
  click = `commands.tapTempo()`. `−`/`+` 1 BPM appear on hover as tiny
  keys under the number (`nudgeBpm`).

### 5.5 Speed gauge

A 34 px SVG dial. 1.00× sits at 12 o'clock; slower fills
counter-clockwise toward 0.25× at ~7 o'clock, faster fills clockwise
toward 2.00× at ~5 o'clock (range mapped linearly over 300°). Twelve
ticks every 0.10 from 0.5 to 1.5 plus the two ends. Interactions:

- Drag vertically: ±0.05 per 6 px.
- Wheel: ±0.05 per notch.
- Click the readout: opens a small popover with the 12 preset chips
  (kept as an explicit fast path; the popover reuses today's rate
  buttons).
- Keyboard: `-`/`=` step 0.05 (already `rateStep`; the step list is
  now 0.25…2.00 by 0.05, so `DEFAULT_RATES` becomes that generated
  list and `availableRates()` unions with it).
- Every change calls `commands.setRate(r)`; the gauge renders from
  `store.rate`.

### 5.6 Edit-edge row and arrange lane

- **EDIT EDGE** `In | Out` segmented control (UI state, default Out
  after a section is recorded, In after a click near a block's left
  edge). `◀`/`▶` call `nudge(edge, ∓0.1)`; the chip shows the selected
  edge's time (`mm:ss.t`, tenths). `Shift/Alt + arrows` keep working as
  today; the selector only affects the ◀ ▶ buttons and drags.
- **Zoom**: slider from 10 s to full length; label "`Ns view`" (or
  "full"). `−`/`+` icons step through 10 / 20 / 50 / 100 / full. Wheel
  over the lane pans; `Shift`+wheel zooms. The view auto-follows the
  playhead while playing (keeps it inside the middle 60 %) unless the
  user has scrolled in the last 3 s.
- **Ruler**: major tick + label every `major` seconds, four minor
  ticks between, where `major` is 10 s for ≤ 50 s views, 30 s ≤ 300 s,
  else 60 s.
- **Lane** (52 px): one block per section, positioned by
  `(t − viewStart) / viewLength`. Blocks outside the view are clipped.
  The active section's block is gold with a glow; its selected edge
  shows a white handle. Click a block → `jumpToSectionId`. Click empty
  lane → `seekTo`. Dragging a block's edge (8 px hit zone) calls
  `commands.setSectionEdge(id, edge, time)` on drop, with `time`
  snapped to the current minor tick (`major / 5`) unless `Alt` is held
  (then 0.1 s). While dragging, the block redraws live from local
  state; the lesson is updated once on release.
- **Recording block**: when `pendingStart !== null`, a striped red
  block from `pendingStart` to `currentTime`, labelled with its running
  duration (`4.2s`). The playhead turns red (`#ff8d76`, glow
  `rgba(255,120,90,.7)`) and the LCD block's border glows red
  (`#5c2a22`, `0 0 8px rgba(230,90,70,.25)`).
- **Playhead**: 1.5 px white line with glow, full lane height; grey
  (`#cfcdc8`, no glow) while paused.
- **Follow rule**: while playing, the view scrolls to keep the playhead
  inside the middle 60 %; while recording it is pinned at ~65 % and the
  ruler scrolls under it.

`setSectionEdge` is a new command (a `nudge` with an absolute value;
same normalisation, same `updateLesson` path).

### 5.7 Video overlay (utility controls)

A translucent dark pill (`rgba(20,20,20,.86)`, 5 px radius, as in
wireframe 1b) anchored to the video's **bottom-right corner**, 8 px
in, holding small neutral keys: `◀` `▶` (frame step) ·
`Normal | Mirror | Rotate` · `Share` · `Library`. It sits in the
un-transformed layer with the click overlay, so it never mirrors or
rotates with the video, and clicks on it do not reach the play/pause
overlay. It is always visible (no hover reveal — hands may be on the
guitar, and touch has no hover); at narrow widths it collapses to
icons only. The video title becomes a one-line caption under the
video; the page header goes away.

### 5.9 Section recording flow (from "Section Recording Flow")

1. **Playing, ready.** MARK armed (enabled) whenever `playerState ===
   'playing'`; disabled otherwise. Nothing selected.
2. **Recording** (`pendingStart !== null`). MARK reads END; loop button
   disabled; red playhead pinned, ruler scrolling; the lane shows the
   growing red block with its duration; the list shows the provisional
   `Recording…` row. END is allowed playing or paused.
3. **Ended.** `markEnd` now: creates the section, **pauses** the player,
   selects the new section, makes it the active section *without
   seeking* (so the playhead stays at its end), turns **looping on**, and
   opens the inline name input with the default name selected. Enter
   commits (blur), Esc keeps the default (blur). Playing from here runs
   the loop: the engine sees `currentTime ≥ end` and starts the count-in
   into the new section.

Engine support: `LoopEngine.arm(section)` — set the active section and
`looping = true` without seeking or playing (new; `activate` keeps its
seek-and-play behaviour for jumps).

Auto-focus after END is the **one** place a hotkey leads into a text
field. It is safe because the video is paused and Enter/Esc return
focus; the earlier ruling against auto-focus stands everywhere else.

### 5.8 Notices and errors

Unchanged behaviour; restyled as a slim bar between the video row and
the transport strip, gold left border for info, red for errors.

## 6. State and data

- Lesson data: `Section.rate` is **removed** (global, session-only
  speed). Share URL section field becomes `name,start,end,bpm,beatsPerBar`.
  The metronome spec's count-in uses the player's current rate.
- `DEFAULT_RATES`: `[0.25, 0.30, …, 2.00]` (36 values, 0.05 step).
  `snapRate` and `rateStep` work unchanged. Task-2-style check: confirm
  YouTube honours 0.55 and 1.35 (it honoured 0.85/0.9); if some are
  rejected, the gauge still shows them and `rate()` reveals the truth.
- New UI store (`ui/arrange/store.ts`): `viewStart`, `viewLength`,
  `editEdge: 'start' | 'end'`, `dragging: { id, edge, time } | null`,
  `followPlayhead: boolean`. Not persisted.
- New pure helpers (`ui/arrange/math.ts`): `snapTo(t, step)`,
  `tickSpacing(viewLength) → { major, minor }`, `visibleRange`,
  `follow(view, playhead)`. Unit-tested.

## 7. Commands

Added: `setSectionEdge(id, edge, seconds)`; `markEnd` gains the §5.9
behaviour; `setRate` no longer persists anything. Everything else exists
(`markStart/markEnd`, `nudge`, `setRate`, `rateStep`, `toggleLoop`,
`restartSection`, `togglePlay`, `seekTo`, `renameSection`,
`deleteSection`, `setFlip`, `stepFrame`, `shareUrl`, `closeLesson`,
and from the metronome spec `tapTempo`, `nudgeBpm`, `setCountIn`).

Hotkeys: unchanged. `G` now cycles count-in (0/1/2 bars) instead of
the seconds gap.

## 8. Accessibility and input

- All strip buttons have `aria-label`s and `title`s with their hotkey.
- The gauge is a `role="slider"` with `aria-valuemin/max/now`; arrow
  keys adjust it when focused.
- Lane blocks are buttons; edge handles are reachable by the In/Out
  selector + ◀ ▶ for keyboard users.
- Touch: 44 px targets on narrow screens; edge dragging is
  pointer-events based so it works with touch on tablets.
- Colour contrast: LCD green on near-black ≥ 7:1; gold-on-ink and
  white-on-blue block labels ≥ 4.5:1.

## 9. Behaviour decisions (all confirmed 2026-09-20)

1. **Seconds gap leaves the UI.** COUNT IN replaces it. For a section
   without a tempo, a count-in setting of 1/2 bars falls back to a
   silent gap of `bars × 2 s`. `Lesson.gap` stays in the model for
   that fallback but has no control.
2. **Sections stay ordered by start.** The wireframe's "drag to
   reorder" is dropped; the lane makes order self-evident and `1`–`9`
   stay stable.
3. **MARK/END is one button** (designer's flow, 2026-09-21): MARK while
   idle and playing, END while recording; END pauses, arms the loop and
   focuses the name field.
4. **Speed is continuous in 0.05 steps.** The preset chips survive in
   a popover for quick jumps.
5. **Renaming is double-click / inline**, no editor panel.
6. **Zoom is UI-only** and resets to "full" when a lesson opens.
7. **Tap tempo lives on the TEMPO cell** (plus `T`).
8. **Speed is global and session-only** (2026-09-21): no `Section.rate`,
   resets to 1× on open, never in the URL.
9. **Name field auto-focuses after END** (designer's flow, 2026-09-21),
   overriding the earlier no-autofocus ruling for this one case.

## 10. Designer answers (2026-09-20)

- Utility controls (mirror/rotate, frame step, share, library): overlay
  on the video, bottom corner → §5.7.
- Position readout: tenths, not hundredths (frames would be preferred
  but the player cannot report frame rate) → §5.4.
- Narrow layout keeps the gauge (44 px).
- Speed readout beside the gauge is the multiplier (`0.80 ×`), not a
  percentage (2026-09-21). After END, Space plays from the section's end
  so the first pass begins with the count-in — intended.
- Styling is **not final**. All colours, gradients and glows are CSS
  custom properties (§4) so a restyle is a token change; component
  structure must not bake in any colour.

## 11. Testing

- Unit: `ui/arrange/math.ts` (snap, tick spacing, follow, visible
  range), the new `setSectionEdge` command, `DEFAULT_RATES`
  generation and `rateStep` at 0.05.
- Browser checklist (Chrome DevTools, as before): record a section
  with MARK/END, see the striped block grow with its duration label and
  the red pinned playhead, then END → paused, loop lit, name field
  focused with the default selected, Esc keeps it; drag an Out edge with
  snapping; zoom to 20 s and confirm auto-follow; gauge drag and wheel
  change `store.rate`; count-in button cycles; double-click rename;
  narrow layout at 390 px with no horizontal scroll; hotkeys still
  work after clicking the lane.

## 12. Relationship to the other specs (agreed)

- **Metronome count-in first**, then this UI (its minimal controls are
  replaced by §5.3/§5.4).
- **Multi-source playback** (`multi-source.md`) gets its own
  reconciliation spec after this UI is working. It is independent of
  the layout: it swaps the video area for artwork and adds a source
  picker; its adapter interface maps onto the existing `PlayerPort`.
