import { useState } from 'preact/hooks';
import { commands, store } from '../app';
import { formatTime } from '../lesson/model';
import { SpeedGauge } from './SpeedGauge';

/** Quick-jump chips behind the speed readout (spec §5.5). */
const PRESET_RATES = [0.25, 0.5, 0.75, 0.8, 0.85, 0.9, 0.95, 1, 1.25, 1.5, 1.75, 2];

export function Lcd() {
  const lesson = store.lesson.value!;
  const rate = store.rate.value;
  const recording = store.pendingStart.value !== null;
  const [presets, setPresets] = useState(false);
  const tempo =
    lesson.bpm > 0 ? (
      <>{lesson.bpm} <small>BPM</small></>
    ) : store.tapCount.value > 0 ? (
      <>tap <small>×{store.tapCount.value}</small></>
    ) : (
      'TAP'
    );

  return (
    <div class={`lcd${recording ? ' rec' : ''}`}>
      <div class="lcd-cell">
        <span class="lcd-label">POSITION</span>
        <span class="lcd-value">{formatTime(store.currentTime.value)}</span>
      </div>
      <div class="lcd-sep" />
      <div class="lcd-cell speed">
        <span class="lcd-label">SPEED</span>
        <div class="lcd-speed">
          <SpeedGauge />
          <button class="lcd-readout" onClick={() => setPresets(!presets)} title="Speed presets (− / = step 0.05)">
            {rate.toFixed(2)} <small>×</small>
          </button>
        </div>
        {presets && (
          <div class="presets" role="menu">
            {PRESET_RATES.map((r) => (
              <button
                key={r}
                class={`key sm${r === rate ? ' lit' : ''}`}
                onClick={() => { commands.setRate(r); setPresets(false); }}
              >
                {r}×
              </button>
            ))}
          </div>
        )}
      </div>
      <div class="lcd-sep" />
      <div class="lcd-cell tempo">
        <span class="lcd-label">TEMPO</span>
        <button class="lcd-readout" onClick={() => commands.tapTempo()} title="Tap on the beat, 4+ times (T)">
          {tempo}
        </button>
        <div class="lcd-keys">
          <button class="key xs" disabled={lesson.bpm === 0} onClick={() => commands.nudgeBpm(-1)} aria-label="Tempo −1 BPM">−</button>
          <button class="key xs" disabled={lesson.bpm === 0} onClick={() => commands.nudgeBpm(1)} aria-label="Tempo +1 BPM">+</button>
          <button
            class="key xs meter"
            onClick={() => commands.setBeatsPerBar(lesson.beatsPerBar === 4 ? 3 : 4)}
            title="Beats per bar"
            aria-label={`Beats per bar: ${lesson.beatsPerBar}`}
          >
            {lesson.beatsPerBar}/4
          </button>
        </div>
      </div>
    </div>
  );
}
