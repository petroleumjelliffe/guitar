import { commands, store } from '../app';
import { MIN_SECTION_LENGTH, formatTime, roundTime } from '../lesson/model';

export function SectionEditor() {
  const lesson = store.lesson.value!;
  const s = lesson.sections.find((x) => x.id === store.selectedSectionId.value);
  if (!s) return null;
  const atMin = roundTime(s.end - s.start) <= MIN_SECTION_LENGTH;

  return (
    <div class="editor">
      <input
        value={s.name}
        onInput={(e) => commands.renameSection(s.id, (e.target as HTMLInputElement).value)}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        aria-label="Section name"
      />
      <div class="editor-row">
        <span class="label">Start</span>
        <button onClick={() => commands.nudge('start', -0.1)} disabled={s.start <= 0} title="Shift+←">−0.1</button>
        <span class="time">{formatTime(s.start)}</span>
        <button onClick={() => commands.nudge('start', 0.1)} disabled={atMin} title="Shift+→">+0.1</button>
      </div>
      <div class="editor-row">
        <span class="label">End</span>
        <button onClick={() => commands.nudge('end', -0.1)} disabled={atMin} title="Alt+←">−0.1</button>
        <span class="time">{formatTime(s.end)}</span>
        <button onClick={() => commands.nudge('end', 0.1)} title="Alt+→">+0.1</button>
      </div>
      <div class="editor-row">
        <span class="label">Tempo</span>
        <button onClick={() => commands.tapTempo()} title="T — tap on the beat, 4+ times">Tap</button>
        <button onClick={() => commands.nudgeBpm(-1)} disabled={s.bpm === 0}>−1</button>
        <span class="time">{s.bpm === 0 ? '—' : `${s.bpm} BPM`}</span>
        <button onClick={() => commands.nudgeBpm(1)} disabled={s.bpm === 0}>+1</button>
        <span class="spacer" />
        <button class={s.beatsPerBar === 3 ? 'active' : ''} onClick={() => commands.setBeatsPerBar(3)}>3/4</button>
        <button class={s.beatsPerBar === 4 ? 'active' : ''} onClick={() => commands.setBeatsPerBar(4)}>4/4</button>
      </div>
      <div class="editor-row">
        <button class="danger" onClick={() => commands.deleteSection(s.id)} title="Delete">Delete section</button>
      </div>
    </div>
  );
}
