import { signal } from '@preact/signals';
import type { View } from './math';

/** UI-only state for the arrange lane. Never persisted. */
export const arrange = {
  /** null = the whole video is in view. */
  view: signal<View | null>(null),
  editEdge: signal<'start' | 'end'>('end'),
  dragging: signal<{ id: string; edge: 'start' | 'end'; time: number } | null>(null),
  /** Wall-clock ms of the last manual pan/zoom; auto-follow pauses for 3 s after it. */
  lastUserScrollAt: signal(0),
};

export function resetArrange(): void {
  arrange.view.value = null;
  arrange.editEdge.value = 'end';
  arrange.dragging.value = null;
  arrange.lastUserScrollAt.value = 0;
}
