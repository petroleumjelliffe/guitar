import { expect, test } from 'vitest';
import { FakeClicker } from './fake';

test('records count-in and stop calls', () => {
  const c = new FakeClicker();
  c.countIn(120, 4, 4, 1000);
  c.stop();
  expect(c.calls).toEqual(['countIn:120:4:4:1000', 'stop']);
});
