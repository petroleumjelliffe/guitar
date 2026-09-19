import { expect, test } from 'vitest';
import { FakePlayer } from './fake';

test('records calls and advances time only while playing', () => {
  const p = new FakePlayer();
  p.advance(1);
  expect(p.currentTime()).toBe(0);
  p.play();
  p.setRate(0.5);
  p.advance(2);
  expect(p.currentTime()).toBe(1);
  p.seek(10);
  p.pause();
  expect(p.calls).toEqual(['play', 'rate:0.5', 'seek:10', 'pause']);
});

test('notifies on state change until unsubscribed', () => {
  const p = new FakePlayer();
  let n = 0;
  const off = p.onStateChange(() => n++);
  p.play();
  off();
  p.pause();
  expect(n).toBe(1);
});
