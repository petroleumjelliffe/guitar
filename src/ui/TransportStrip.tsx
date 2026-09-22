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
          <button class="key rewind" onClick={() => commands.restartSection()} title="Restart section (Enter / PageUp)" aria-label="Restart section">
            <svg width="15" height="12" viewBox="0 0 15 12" fill="currentColor" aria-hidden="true"><path d="M2 1h1.6v10H2zM13 1v10L5.5 6z" /></svg>
          </button>
          <button
            class={`key play${playing ? ' lit' : ''}`}
            onClick={() => commands.togglePlay()}
            title="Play / pause (Space)"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            <svg width="13" height="14" viewBox="0 0 13 14" fill="currentColor" aria-hidden="true">
              {playing ? <path d="M1 1h4v12H1zM8 1h4v12H8z" /> : <path d="M2 1l10 6-10 6z" />}
            </svg>
          </button>
          <button
            class={`key loop${store.looping.value ? ' lit' : ''}${store.inGap.value ? ' pulse' : ''}`}
            disabled={recording}
            onClick={() => commands.toggleLoop()}
            title="Loop the section (L)"
            aria-label="Toggle loop"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
              <path d="M1 7a6 6 0 016-6 6 6 0 015.2 3" />
              <path d="M13 7a6 6 0 01-6 6 6 6 0 01-5.2-3" />
              <path d="M12.3 1v3h-3" stroke-linejoin="round" />
              <path d="M1.7 13v-3h3" stroke-linejoin="round" />
            </svg>
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
