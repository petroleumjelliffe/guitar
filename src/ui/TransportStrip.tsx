import { commands, store } from '../app';
import { Lcd } from './Lcd';

export function TransportStrip() {
  const lesson = store.lesson.value!;
  const playing = store.playerState.value === 'playing';
  const recording = store.pendingStart.value !== null;
  const countLabel = lesson.countIn === 0 ? 'off' : lesson.countIn === 1 ? '1 bar' : '2 bars';

  return (
    <div class="strip-row transport-strip">
      <div class="group">
        <span class="group-label">TRANSPORT</span>
        <div class="keys">
          <button class="key" onClick={() => commands.restartSection()} title="Restart section (Enter / PageUp)" aria-label="Restart section">⏮</button>
          <button
            class={`key play${playing ? ' lit' : ''}`}
            onClick={() => commands.togglePlay()}
            title="Play / pause (Space)"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? '❚❚' : '▶'}
          </button>
          <button
            class={`key loop${store.looping.value ? ' lit' : ''}${store.inGap.value ? ' pulse' : ''}`}
            disabled={recording}
            onClick={() => commands.toggleLoop()}
            title="Loop the section (L)"
            aria-label="Toggle loop"
          >
            ⟳
          </button>
          {recording ? (
            <button class="key end" onClick={() => commands.markEnd()} title="End the section here (])">
              ■ END
            </button>
          ) : (
            <button class="key mark" disabled={!playing} onClick={() => commands.markStart()} title="Start a section here ([) — while playing">
              <span class="mark-dot" /> MARK
            </button>
          )}
        </div>
      </div>
      <div class="group">
        <span class="group-label">COUNT IN</span>
        <button
          class={`key count${lesson.bpm === 0 ? ' dim' : ''}`}
          onClick={() => commands.cycleCountIn()}
          title={lesson.bpm === 0 ? 'Tap a tempo first (T) — without one, bars are 2 s of silence' : 'Bars of clicks before each restart (G)'}
        >
          {countLabel}
        </button>
      </div>
      <Lcd />
    </div>
  );
}
