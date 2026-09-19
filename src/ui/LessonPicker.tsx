import { useState } from 'preact/hooks';
import { commands, store } from '../app';

export function LessonPicker() {
  const [input, setInput] = useState('');
  return (
    <div class="picker">
      <h1>Loop Lesson</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          commands.openInput(input);
        }}
      >
        <input
          type="url"
          placeholder="Paste a YouTube link"
          value={input}
          onInput={(e) => setInput((e.target as HTMLInputElement).value)}
          autoFocus
        />
        <button type="submit">Open</button>
      </form>
      {store.inputError.value && <p class="input-error">{store.inputError.value}</p>}
      {store.library.value.length > 0 && (
        <ul class="library">
          {store.library.value.map((l) => (
            <li key={l.videoId}>
              <button class="library-item" onClick={() => commands.openLesson(l.videoId)}>
                <span class="library-title">{l.title}</span>
                <span class="library-meta">
                  {l.sectionCount} section{l.sectionCount === 1 ? '' : 's'} · {new Date(l.updatedAt).toLocaleDateString()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
