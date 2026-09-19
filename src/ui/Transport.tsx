import { useState } from 'preact/hooks';
import { commands, store } from '../app';
import { formatTime } from '../lesson/model';

export function Transport() {
  const lesson = store.lesson.value!;
  const playing = store.playerState.value === 'playing';
  const [copied, setCopied] = useState(false);

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
          <button key={g} class={g === lesson.gap ? 'active' : ''} onClick={() => commands.setGap(g)} title="G cycles">
            {g === 0 ? 'none' : `${g}s`}
          </button>
        ))}
        <span class="spacer" />
        <button onClick={() => commands.stepFrame(-1)} title=",">◀ frame</button>
        <button onClick={() => commands.stepFrame(1)} title=".">frame ▶</button>
        <button class={store.mirror.value ? 'active' : ''} onClick={() => commands.toggleMirror()} title="M">Mirror</button>
        <button class={store.rotate.value ? 'active' : ''} onClick={() => commands.toggleRotate()} title="R">Rotate</button>
        <button
          onClick={() => {
            navigator.clipboard.writeText(commands.shareUrl()).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? 'Copied' : 'Share link'}
        </button>
      </div>
    </div>
  );
}
