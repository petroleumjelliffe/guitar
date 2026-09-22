import { store } from '../app';
import { LessonPicker } from './LessonPicker';
import { Notice } from './Notice';
import { SectionsPanel } from './SectionsPanel';
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
      <Notice />
      <Stage videoId={lesson.videoId} />
      <div class="caption">{lesson.title}</div>
      <Timeline />
      <div class="lesson-body">
        <Transport />
        <SectionsPanel />
      </div>
    </main>
  );
}
