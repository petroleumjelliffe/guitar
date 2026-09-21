import { useEffect, useState } from 'preact/hooks';
import { commands, store } from '../app';
import { formatTime } from '../lesson/model';
import type { FlipMode } from '../state/store';

const FLIPS: Array<[FlipMode, string, string]> = [['normal', 'Normal', ''], ['mirror', 'Mirror', 'M'], ['rotate', 'Rotate', 'R']];

export function Transport() {
  const lesson = store.lesson.value!;
  const playing = store.playerState.value === 'playing';
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <div class="transport">
      <div class="transport-row">
        <button class="big" onClick={() => commands.togglePlay()} title="Space">
          {playing ? '❚❚' : '▶'}
        </button>
        <button onClick={() => commands.restartSection()} title="Enter / PageUp">↺ Restart</button>
        <button class={store.looping.value ? 'active' : ''} onClick={() => commands.toggleLoop()} title="L">
          Loop{store.inGap.value ? ' …' : ''}
        </button>
        <span class="time">{formatTime(store.currentTime.value)} / {formatTime(store.duration.value)}</span>
      </div>
      <div class="transport-row">
        <span class="label">Speed</span>
        {store.availableRates.value.map((r) => (
          <button key={r} class={r === store.rate.value ? 'active' : ''} onClick={() => commands.setRate(r)}>
            {r}×
          </button>
        ))}
      </div>
      <div class="transport-row">
        <span class="label">Gap</span>
        {[0, 1, 2, 3].map((g) => (
          <button
            key={g}
            class={g === lesson.gap ? 'active' : ''}
            onClick={() => commands.setGap(g)}
            title="G cycles · used when the section has no tempo"
          >
            {g === 0 ? 'none' : `${g}s`}
          </button>
        ))}
        <span class="label">Count-in</span>
        {([0, 1, 2] as const).map((bars) => (
          <button
            key={bars}
            class={bars === lesson.countIn ? 'active' : ''}
            onClick={() => commands.setCountIn(bars)}
            title="Clicks before each loop restart; needs a tapped tempo"
          >
            {bars === 0 ? 'off' : bars === 1 ? '1 bar' : '2 bars'}
          </button>
        ))}
        <span class="spacer" />
        <button onClick={() => commands.stepFrame(-1)} title=",">◀ frame</button>
        <button onClick={() => commands.stepFrame(1)} title=".">frame ▶</button>
        <span class="label">View</span>
        {FLIPS.map(([mode, label, key]) => (
          <button key={mode} class={mode === store.flip.value ? 'active' : ''} onClick={() => commands.setFlip(mode)} title={key}>
            {label}
          </button>
        ))}
        <button
          onClick={() => {
            const url = commands.shareUrl();
            const copy = navigator.clipboard?.writeText(url) ?? Promise.reject(new Error('no clipboard'));
            copy.then(() => setCopied(true)).catch(() => window.prompt('Copy this link', url));
          }}
        >
          {copied ? 'Copied' : 'Share link'}
        </button>
      </div>
    </div>
  );
}
