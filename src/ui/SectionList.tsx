import { commands, store } from '../app';
import { formatTime } from '../lesson/model';

export function SectionList() {
  const lesson = store.lesson.value!;
  const pending = store.pendingStart.value;
  return (
    <div class="sections">
      <div class="sections-mark">
        <button onClick={() => commands.markStart()} title="[">
          {pending === null ? '+ mark start' : `start ${formatTime(pending)} — press ] to finish`}
        </button>
        <button onClick={() => commands.markEnd()} title="]" disabled={pending === null && !store.activeSectionId.value}>
          + mark end
        </button>
      </div>
      {lesson.sections.length === 0 && (
        <p class="hint">Play to the start of a passage, press <kbd>[</kbd>, play to the end, press <kbd>]</kbd>.</p>
      )}
      <ol class="section-list">
        {lesson.sections.map((s, i) => {
          const active = s.id === store.activeSectionId.value;
          const selected = s.id === store.selectedSectionId.value;
          return (
            <li key={s.id} class={`section-row${active ? ' active' : ''}${selected ? ' selected' : ''}`}>
              <button class="section-jump" onClick={() => commands.jumpToSectionId(s.id)} title={i < 9 ? String(i + 1) : ''}>
                <span class="section-num">{i + 1}</span>
                <span class="section-name">{s.name}</span>
                <span class="section-range">{formatTime(s.start)}–{formatTime(s.end)}</span>
              </button>
              <button class="link" onClick={() => commands.selectSection(selected ? null : s.id)}>
                {selected ? 'Done' : 'Edit'}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
