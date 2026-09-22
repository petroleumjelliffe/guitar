import { useEffect, useState } from 'preact/hooks';
import { commands, store } from '../app';
import type { FlipMode } from '../state/store';

const FLIPS: Array<[FlipMode, string, string, string]> = [
  ['normal', 'Normal', '', '▭'],
  ['mirror', 'Mirror', 'M', '⇔'],
  ['rotate', 'Rotate', 'R', '↻'],
];

/** Utility controls pinned to the video's bottom-right corner (spec §5.7). */
export function VideoOverlay() {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const share = () => {
    const url = commands.shareUrl();
    const copy = navigator.clipboard?.writeText(url) ?? Promise.reject(new Error('no clipboard'));
    copy.then(() => setCopied(true)).catch(() => window.prompt('Copy this link', url));
  };

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
      <span class="overlay-sep" />
      <button class="key sm" onClick={share} title="Copy a link to this lesson" aria-label={copied ? 'Copied' : 'Share'}>
        <span class="txt">{copied ? 'Copied' : 'Share'}</span>
        <span class="ico" aria-hidden="true">⤴</span>
      </button>
      <button class="key sm" onClick={() => commands.closeLesson()} title="Back to the library" aria-label="Library">
        <span class="txt">Library</span>
        <span class="ico" aria-hidden="true">☰</span>
      </button>
    </div>
  );
}
