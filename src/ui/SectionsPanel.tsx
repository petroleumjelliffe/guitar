import { useEffect, useRef, useState } from 'preact/hooks';
import { commands, store } from '../app';
import { formatDuration } from './arrange/math';

/**
 * Inline name editor. Mounted only while `store.editingSectionId === id`, so
 * mounting IS the "open" event: it focuses and selects the default name (the
 * one sanctioned auto-focus, spec §5.9 — the video is paused at that point).
 */
function NameField({ id, name }: { id: string; name: string }) {
  const [draft, setDraft] = useState(name);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    const next = draft.trim();
    if (commit && next && next !== name) commands.renameSection(id, next);
    commands.endRename();
  };

  return (
    <input
      ref={ref}
      class="name-field"
      value={draft}
      aria-label="Section name"
      onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(true);
        else if (e.key === 'Escape') finish(false);
      }}
      onBlur={() => finish(true)}
    />
  );
}

export function SectionsPanel() {
  const lesson = store.lesson.value!;
  const playing = store.playerState.value === 'playing';
  const pending = store.pendingStart.value;
  const recording = pending !== null;
  const editing = store.editingSectionId.value;
  const activeId = store.activeSectionId.value;
  const selectedId = store.selectedSectionId.value;

  return (
    <section class="panel sections-panel" aria-label="Sections">
      <header class="panel-head">
        <span>SECTIONS</span>
        <button
          class="panel-key"
          onClick={() => commands.markStart()}
          disabled={!playing || recording}
          title="Start a section here ([) — plays only"
          aria-label="Mark section start"
        >
          +
        </button>
      </header>
      <ol class="panel-rows">
        {lesson.sections.map((s, i) => {
          const state = s.id === activeId ? ' active' : s.id === selectedId ? ' selected' : '';
          return (
            <li key={s.id} class={`row${state}`}>
              {editing === s.id ? (
                <NameField id={s.id} name={s.name} />
              ) : (
                <button
                  class="row-jump"
                  onClick={() => commands.jumpToSectionId(s.id)}
                  onDblClick={() => commands.beginRename(s.id)}
                  title={i < 9 ? `${s.name} (${i + 1})` : s.name}
                >
                  <span class="row-num">{i + 1}</span>
                  <span class="row-name">{s.name}</span>
                </button>
              )}
              <span class="row-dur">{formatDuration(s.end - s.start)}</span>
            </li>
          );
        })}
        {pending !== null && (
          <li class="row recording">
            <span class="row-name"><span class="dot" /> Recording…</span>
            <span class="row-dur">{formatDuration(store.currentTime.value - pending)}</span>
          </li>
        )}
      </ol>
      <footer class="panel-foot">
        {lesson.sections.length === 0 && !recording
          ? 'Play, then press [ at the start of a passage and ] at its end.'
          : 'Enter to commit · Esc to keep · double-click a name to rename'}
      </footer>
    </section>
  );
}
