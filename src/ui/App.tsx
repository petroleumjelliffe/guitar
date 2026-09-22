import { store } from '../app';
import { LessonPicker } from './LessonPicker';
import { Notice } from './Notice';
import { SectionsPanel } from './SectionsPanel';
import { Stage } from './Stage';
import { Timeline } from './Timeline';
import { TransportStrip } from './TransportStrip';

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
        <div class="strip"><TransportStrip /></div>
        <SectionsPanel />
      </div>
    </main>
  );
}
