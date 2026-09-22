import { roundTime } from '../../lesson/model';

/** Zoom presets in seconds; the "full" zoom is represented by a null view. */
export const ZOOM_STEPS = [10, 20, 50, 100] as const;
export const RATE_MIN = 0.25;
export const RATE_MAX = 2;
export const RATE_STEP = 0.05;

export interface View {
  start: number;  // seconds
  length: number; // seconds
}

export function snapTo(t: number, step: number): number {
  return roundTime(Math.round(t / step) * step);
}

export function tickSpacing(viewLength: number): { major: number; minor: number } {
  const major = viewLength <= 50 ? 10 : viewLength <= 300 ? 30 : 60;
  return { major, minor: major / 5 };
}

export function clampView(view: View, duration: number): View {
  const length = Math.min(view.length, duration);
  const start = Math.max(0, Math.min(view.start, duration - length));
  return { start, length };
}

/** Keep the playhead inside the middle 60 % of the view; recentre otherwise. */
export function follow(view: View, playhead: number, duration: number): View {
  const lo = view.start + view.length * 0.2;
  const hi = view.start + view.length * 0.8;
  if (playhead >= lo && playhead <= hi) return view;
  return clampView({ start: playhead - view.length / 2, length: view.length }, duration);
}

/** Hold the playhead at a fixed fraction of the view (recording). */
export function pinned(view: View, playhead: number, duration: number, fraction = 0.65): View {
  return clampView({ start: playhead - view.length * fraction, length: view.length }, duration);
}

export function rulerTicks(view: View): Array<{ t: number; major: boolean }> {
  const { major, minor } = tickSpacing(view.length);
  const ticks: Array<{ t: number; major: boolean }> = [];
  const first = Math.ceil(view.start / minor) * minor;
  for (let t = first; t < view.start + view.length; t += minor) {
    const tt = roundTime(t);
    ticks.push({ t: tt, major: Math.abs(tt / major - Math.round(tt / major)) < 1e-6 });
  }
  return ticks;
}

/** 1× at 12 o'clock; slower sweeps counter-clockwise to −150°, faster clockwise to +150°. */
export function rateToAngle(rate: number): number {
  if (rate < 1) return ((rate - 1) / (1 - RATE_MIN)) * 150;
  return ((rate - 1) / (RATE_MAX - 1)) * 150;
}

export function formatDuration(seconds: number): string {
  return `${roundTime(Math.max(0, seconds)).toFixed(1)}s`;
}

export function formatRulerLabel(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}
