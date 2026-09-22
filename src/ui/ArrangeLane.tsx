import { useEffect, useRef } from 'preact/hooks';
import { commands, store } from '../app';
import { formatTime, roundTime } from '../lesson/model';
import { arrange } from './arrange/store';
import {
  ZOOM_STEPS, clampView, follow, formatDuration, formatRulerLabel, pinned, rulerTicks, snapTo, tickSpacing,
  type View,
} from './arrange/math';

const FOLLOW_PAUSE_MS = 3000;

export function ArrangeLane({ compact = false }: { compact?: boolean }) {
  const lesson = store.lesson.value!;
  const duration = Math.max(store.duration.value, 1);
  const zoom = arrange.view.value;
  const view: View = zoom ? clampView(zoom, duration) : { start: 0, length: duration };
  const playing = store.playerState.value === 'playing';
  const pending = store.pendingStart.value;
  const recording = pending !== null;
  const t = store.currentTime.value;
  const laneRef = useRef<HTMLDivElement>(null);
  const didDrag = useRef(false);

  // Auto-follow: keep the playhead in the middle band while playing; pin it
  // at 65 % while recording; back off for 3 s after a manual pan/zoom. The
  // hidden compact instance (narrow layout only shows it via CSS, but both
  // mount) must not also write arrange.view.
  useEffect(() => {
    if (compact || !zoom || !playing) return;
    if (Date.now() - arrange.lastUserScrollAt.value < FOLLOW_PAUSE_MS) return;
    const next = recording ? pinned(view, t, duration) : follow(view, t, duration);
    if (next.start !== view.start) arrange.view.value = next;
  }, [t, playing, recording]);

  const x = (time: number) => `${((time - view.start) / view.length) * 100}%`;
  const w = (len: number) => `${(len / view.length) * 100}%`;
  const timeAt = (clientX: number) => {
    const r = laneRef.current!.getBoundingClientRect();
    return view.start + ((clientX - r.left) / r.width) * view.length;
  };
  const { minor } = tickSpacing(view.length);
  const selectedId = store.selectedSectionId.value ?? store.activeSectionId.value;
  const selected = lesson.sections.find((s) => s.id === selectedId);
  const edge = arrange.editEdge.value;
  const drag = arrange.dragging.value;

  // Zoom: index into ZOOM_STEPS, or ZOOM_STEPS.length for "full".
  const zoomIndex = zoom ? Math.max(0, ZOOM_STEPS.findIndex((z) => z >= zoom.length)) : ZOOM_STEPS.length;
  const setZoom = (index: number) => {
    arrange.lastUserScrollAt.value = Date.now();
    if (index >= ZOOM_STEPS.length) { arrange.view.value = null; return; }
    const length = ZOOM_STEPS[index]!;
    arrange.view.value = clampView({ start: t - length / 2, length }, duration);
  };
  const zoomStep = (dir: -1 | 1) => setZoom(Math.max(0, Math.min(ZOOM_STEPS.length, zoomIndex + dir)));

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (e.shiftKey) { zoomStep(e.deltaY > 0 ? 1 : -1); return; }
    if (!zoom) return; // full view: nothing to pan
    const width = laneRef.current!.getBoundingClientRect().width;
    const delta = ((e.deltaX || e.deltaY) / width) * view.length;
    arrange.view.value = clampView({ start: view.start + delta, length: view.length }, duration);
    arrange.lastUserScrollAt.value = Date.now();
  };

  // Edge dragging: live-preview in arrange.dragging, commit once on release.
  const startDrag = (e: PointerEvent, id: string, which: 'start' | 'end') => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    arrange.editEdge.value = which;
    commands.selectSection(id);
    arrange.dragging.value = { id, edge: which, time: roundTime(timeAt(e.clientX)) };
  };
  const moveDrag = (e: PointerEvent) => {
    if (!drag) return;
    didDrag.current = true;
    const step = e.altKey ? 0.1 : minor;
    arrange.dragging.value = { ...drag, time: snapTo(timeAt(e.clientX), step) };
  };
  const endDrag = () => {
    if (!drag) return;
    commands.setSectionEdge(drag.id, drag.edge, drag.time);
    arrange.dragging.value = null;
    // Reset after the click that follows the release has had a chance to see it.
    setTimeout(() => { didDrag.current = false; }, 0);
  };
  const bounds = (s: { id: string; start: number; end: number }) => {
    if (drag?.id !== s.id) return s;
    return drag.edge === 'start'
      ? { start: Math.min(drag.time, s.end - 0.2), end: s.end }
      : { start: s.start, end: Math.max(drag.time, s.start + 0.2) };
  };

  // Desktop always shows the edit row (with the zoom cluster); compact only
  // shows it — without zoom — while a section is selected (spec §3).
  const showEditRow = !compact || !!selected;
  const showZoom = !compact;

  return (
    <div class={`arrange${compact ? ' compact' : ''}`}>
      {showEditRow && (
        <div class="edit-row">
          <span class="group-label">EDIT EDGE</span>
          <div class="segmented" role="radiogroup" aria-label="Edge to edit">
            <button class={`seg${edge === 'start' ? ' lit' : ''}`} role="radio" aria-checked={edge === 'start'} onClick={() => { arrange.editEdge.value = 'start'; }}>In</button>
            <button class={`seg${edge === 'end' ? ' lit' : ''}`} role="radio" aria-checked={edge === 'end'} onClick={() => { arrange.editEdge.value = 'end'; }}>Out</button>
          </div>
          <button class="key xs" disabled={!selected} onClick={() => commands.nudge(edge, -0.1)} aria-label="Nudge edge earlier (Shift/Alt+←)">◀</button>
          <button class="key xs" disabled={!selected} onClick={() => commands.nudge(edge, 0.1)} aria-label="Nudge edge later (Shift/Alt+→)">▶</button>
          <span class="fine">±0.10s</span>
          <span class="chip">{selected ? formatTime(selected[edge]) : '—'}</span>
          {showZoom && (
            <>
              <span class="spacer" />
              <span class="fine">{zoom ? `${zoom.length}s view` : 'full'}</span>
              <button class="key xs" disabled={zoomIndex === 0} onClick={() => zoomStep(-1)} aria-label="Zoom in">+</button>
              <input
                type="range"
                class="zoom"
                min={0}
                max={ZOOM_STEPS.length}
                step={1}
                value={zoomIndex}
                onInput={(e) => setZoom(Number((e.target as HTMLInputElement).value))}
                onPointerUp={(e) => (e.currentTarget as HTMLElement).blur()}
                aria-label="Zoom"
              />
              <button class="key xs" disabled={!zoom} onClick={() => zoomStep(1)} aria-label="Zoom out">−</button>
            </>
          )}
        </div>
      )}
      {!compact && (
        <div class="ruler">
          {rulerTicks(view).map((k) => (
            <span key={k.t} class={`tick${k.major ? ' major' : ''}`} style={{ left: x(k.t) }}>
              {k.major && <span class="tick-label">{formatRulerLabel(k.t)}</span>}
            </span>
          ))}
        </div>
      )}
      <div
        ref={laneRef}
        class={`lane${recording ? ' rec' : ''}`}
        onWheel={onWheel}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={() => { arrange.dragging.value = null; didDrag.current = false; }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('.block')) return;
          commands.seekTo(timeAt(e.clientX));
        }}
      >
        {lesson.sections.map((s) => {
          const b = bounds(s);
          const active = s.id === store.activeSectionId.value;
          const sel = s.id === selectedId;
          return (
            <div
              key={s.id}
              class={`block${active ? ' active' : sel ? ' selected' : ''}`}
              style={{ left: x(b.start), width: w(b.end - b.start) }}
              role="button"
              tabIndex={0}
              title={s.name}
              onClick={(e) => {
                e.stopPropagation();
                if (didDrag.current) { didDrag.current = false; return; }
                commands.jumpToSectionId(s.id);
              }}
              onDblClick={(e) => { e.stopPropagation(); commands.beginRename(s.id); }}
              onKeyDown={(e) => {
                // Activate like a native button: Space must not scroll the page.
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); commands.jumpToSectionId(s.id); }
              }}
            >
              <span class="block-label">{s.name}</span>
              {!compact && <span class={`handle start${sel && edge === 'start' ? ' grabbed' : ''}`} onPointerDown={(e) => startDrag(e, s.id, 'start')} />}
              {!compact && <span class={`handle end${sel && edge === 'end' ? ' grabbed' : ''}`} onPointerDown={(e) => startDrag(e, s.id, 'end')} />}
            </div>
          );
        })}
        {pending !== null && (
          <div class="block recording" style={{ left: x(pending), width: w(Math.max(0, t - pending)) }}>
            {formatDuration(t - pending)}
          </div>
        )}
        <div class={`playhead${recording ? ' rec' : playing ? '' : ' paused'}`} style={{ left: x(t) }} />
      </div>
    </div>
  );
}
