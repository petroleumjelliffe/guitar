import { useEffect } from 'preact/hooks';
import { store } from '../app';
import { ArrangeLane } from './ArrangeLane';
import { LessonPicker } from './LessonPicker';
import { Notice } from './Notice';
import { SectionsPanel } from './SectionsPanel';
import { Stage } from './Stage';
import { TitleBar } from './TitleBar';
import { TransportStrip } from './TransportStrip';
import { resetArrange } from './arrange/store';

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
    <main class="app card">
      <TitleBar />
      <div class="top">
        <div class="video-col">
          <Stage videoId={lesson.videoId} />
        </div>
        <SectionsPanel />
      </div>
      <Notice />
      {/* Narrow layout only: a thin section strip under the video. */}
      <ArrangeLane compact />
      <div class="strip">
        <TransportStrip />
        <ArrangeLane />
      </div>
    </main>
  );
}
