import { useRef } from 'preact/hooks';
import { commands, store } from '../app';
import { RATE_MAX, RATE_MIN, RATE_STEP, rateToAngle } from './arrange/math';

const C = 15;      // centre of the 30×30 viewBox
const R = 11.5;    // arc radius
const TICK_RATES = [RATE_MIN, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, RATE_MAX];

function polar(deg: number, r: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

function arc(fromDeg: number, toDeg: number): string {
  if (Math.abs(toDeg - fromDeg) < 0.01) return '';
  const [x1, y1] = polar(fromDeg, R);
  const [x2, y2] = polar(toDeg, R);
  const sweep = toDeg > fromDeg ? 1 : 0;
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${R} ${R} 0 ${large} ${sweep} ${x2} ${y2}`;
}

const clampRate = (r: number) => Math.min(RATE_MAX, Math.max(RATE_MIN, Math.round(r * 100) / 100));

/** 1× at 12 o'clock; slower fills counter-clockwise, faster clockwise. Drag, wheel or arrow keys. */
export function SpeedGauge() {
  const rate = store.rate.value;
  const drag = useRef<{ y: number; rate: number } | null>(null);
  const angle = rateToAngle(rate);
  const step = (n: number) => commands.setRate(clampRate(rate + n * RATE_STEP));

  return (
    <svg
      class="gauge"
      width="34"
      height="34"
      viewBox="0 0 30 30"
      role="slider"
      // Preact writes `tabIndex` on SVG via a case-sensitive setAttribute, so the
      // camelCase prop never becomes the real `tabindex` attribute; use lowercase.
      tabindex={0}
      aria-label="Playback speed"
      aria-valuemin={RATE_MIN}
      aria-valuemax={RATE_MAX}
      aria-valuenow={rate}
      aria-valuetext={`${rate.toFixed(2)}×`}
      onPointerDown={(e) => {
        drag.current = { y: e.clientY, rate };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const steps = Math.round((drag.current.y - e.clientY) / 6); // up = faster
        const next = clampRate(drag.current.rate + steps * RATE_STEP);
        if (next !== rate) commands.setRate(next);
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
      onWheel={(e) => { e.preventDefault(); step(e.deltaY < 0 ? 1 : -1); }}
      onKeyDown={(e) => {
        // Stop the global hotkeys (←/→ seek) from also firing while the dial has focus.
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); step(1); }
        else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); step(-1); }
      }}
    >
      <circle cx={C} cy={C} r={R} fill="none" stroke="var(--lcd-track)" stroke-width="3" />
      <path d={arc(0, angle)} fill="none" stroke="var(--lcd)" stroke-width="3" stroke-linecap="round" />
      {TICK_RATES.map((r) => {
        const [x1, y1] = polar(rateToAngle(r), 8.6);
        const [x2, y2] = polar(rateToAngle(r), r === 1 ? 13.4 : 12.6);
        return <line key={r} x1={x1} y1={y1} x2={x2} y2={y2} stroke={r === 1 ? 'var(--lcd)' : '#2c5d4a'} stroke-width={r === 1 ? 1.6 : 1} stroke-linecap="round" />;
      })}
    </svg>
  );
}
