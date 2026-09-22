import { useEffect } from 'preact/hooks';
import { store } from '../app';
import { ArrangeLane } from './ArrangeLane';
import { resetArrange } from './arrange/store';
import { LessonPicker } from './LessonPicker';
import { Notice } from './Notice';
import { SectionsPanel } from './SectionsPanel';
import { Stage } from './Stage';
import { TransportStrip } from './TransportStrip';

export function App() {
  const lesson = store.lesson.value;
  useEffect(() => { resetArrange(); }, [lesson?.videoId]);
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
      <div class="lesson-body">
        <div class="strip">
          <TransportStrip />
          <ArrangeLane />
        </div>
        <SectionsPanel />
      </div>
    </main>
  );
}
