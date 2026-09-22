import { commands, store } from '../app';
import type { FlipMode } from '../state/store';

const FLIPS: Array<[FlipMode, string, string, string]> = [
  ['normal', 'Normal', '', '▭'],
  ['mirror', 'Mirror', 'M', '⇔'],
  ['rotate', 'Rotate', 'R', '↻'],
];

/** Utility controls pinned to the video's bottom-right corner (spec §5.7). */
export function VideoOverlay() {
  return (
    <div class="video-overlay">
      <button class="key sm" onClick={() => commands.stepFrame(-1)} title="Step back one frame (,)" aria-label="Step back one frame">◀</button>
      <button class="key sm" onClick={() => commands.stepFrame(1)} title="Step forward one frame (.)" aria-label="Step forward one frame">▶</button>
      <span class="overlay-sep" />
      {FLIPS.map(([mode, label, key, icon]) => (
        <button
          key={mode}
          class={`key sm${mode === store.flip.value ? ' lit' : ''}`}
          onClick={() => commands.setFlip(mode)}
          title={key ? `${label} (${key})` : label}
          aria-label={label}
        >
          <span class="txt">{label}</span>
          <span class="ico" aria-hidden="true">{icon}</span>
        </button>
      ))}
    </div>
  );
}
