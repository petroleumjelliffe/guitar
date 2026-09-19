import { commands, store } from '../app';
import { LessonPicker } from './LessonPicker';
import { Notice } from './Notice';
import { SectionEditor } from './SectionEditor';
import { SectionList } from './SectionList';
import { Stage } from './Stage';
import { Timeline } from './Timeline';
import { Transport } from './Transport';

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
      <Timeline />
      <div class="lesson-body">
        <Transport />
        <div class="lesson-side">
          <SectionList />
          <SectionEditor />
        </div>
      </div>
    </main>
  );
}
