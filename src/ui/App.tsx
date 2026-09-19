import { commands, store } from '../app';
import { LessonPicker } from './LessonPicker';
import { Notice } from './Notice';
import { Stage } from './Stage';

export function App() {
  const lesson = store.lesson.value;
  if (!lesson) {
    return (
      <main class="app">
        <Notice />
        <LessonPicker />
      </main>
    );
  }
  return (
    <main class="app lesson">
      <header class="lesson-header">
        <button class="link" onClick={() => commands.closeLesson()}>← Library</button>
        <h1 class="lesson-title">{lesson.title}</h1>
      </header>
      <Notice />
      <Stage videoId={lesson.videoId} />
      {/* Task 15 adds Timeline, Transport, SectionList, SectionEditor here */}
    </main>
  );
}
