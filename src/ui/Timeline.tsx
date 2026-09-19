import { commands, store } from '../app';

const COLORS = ['#f5a623', '#4fc3f7', '#81c784', '#ba68c8', '#ff8a65', '#fff176', '#90a4ae', '#f06292', '#a1887f'];

export function Timeline() {
  const lesson = store.lesson.value!;
  const duration = store.duration.value || 1;
  const pct = (t: number) => `${(Math.min(t, duration) / duration) * 100}%`;
  const pending = store.pendingStart.value;

  return (
    <div
      class="timeline"
      onClick={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        commands.seekTo(((e.clientX - rect.left) / rect.width) * duration);
      }}
    >
      {lesson.sections.map((s, i) => (
        <div
          key={s.id}
          class={`timeline-section${s.id === store.activeSectionId.value ? ' active' : ''}`}
          style={{ left: pct(s.start), width: pct(s.end - s.start), background: COLORS[i % COLORS.length] }}
          title={s.name}
        />
      ))}
      {pending !== null && <div class="timeline-pending" style={{ left: pct(pending) }} />}
      <div class="timeline-playhead" style={{ left: pct(store.currentTime.value) }} />
    </div>
  );
}
