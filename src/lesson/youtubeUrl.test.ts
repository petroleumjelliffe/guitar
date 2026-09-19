import { expect, test } from 'vitest';
import { parseVideoId } from './youtubeUrl';

const ID = 'dQw4w9WgXcQ';

test.each([
  [`https://www.youtube.com/watch?v=${ID}`, ID],
  [`https://youtube.com/watch?v=${ID}&t=42s&list=PL123`, ID],
  [`https://m.youtube.com/watch?v=${ID}`, ID],
  [`https://youtu.be/${ID}`, ID],
  [`https://youtu.be/${ID}?t=10`, ID],
  [`https://www.youtube.com/shorts/${ID}`, ID],
  [`https://www.youtube.com/embed/${ID}`, ID],
  [`https://www.youtube.com/live/${ID}`, ID],
  [`  ${ID}  `, ID],
  ['https://vimeo.com/12345', null],
  ['https://www.youtube.com/', null],
  ['https://www.youtube.com/watch?v=short', null],
  ['not a url', null],
  ['', null],
])('parseVideoId(%s) → %s', (input, expected) => {
  expect(parseVideoId(input)).toBe(expected);
});
