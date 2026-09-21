import { describe, expect, test } from 'vitest';
import { keyToCommand, type KeyInput } from './hotkeys';

const k = (key: string, over: Partial<KeyInput> = {}): KeyInput => ({
  key, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, inInput: false, ...over,
});

describe('keyToCommand', () => {
  test.each<[KeyInput, unknown]>([
    [k(' '), ['togglePlay']],
    [k('Enter'), ['restartSection']],
    [k('PageUp'), ['restartSection']],
    [k('ArrowUp'), ['restartSection']],
    [k('PageDown'), ['nextSection']],
    [k('ArrowDown'), ['nextSection']],
    [k('l'), ['toggleLoop']],
    [k('L'), ['toggleLoop']],
    [k('1'), ['jumpToSection', 1]],
    [k('9'), ['jumpToSection', 9]],
    [k('0'), null],
    [k('ArrowLeft'), ['seekBy', -3]],
    [k('ArrowRight'), ['seekBy', 3]],
    [k('ArrowLeft', { shiftKey: true }), ['nudge', 'start', -0.1]],
    [k('ArrowRight', { shiftKey: true }), ['nudge', 'start', 0.1]],
    [k('ArrowLeft', { altKey: true }), ['nudge', 'end', -0.1]],
    [k('ArrowRight', { altKey: true }), ['nudge', 'end', 0.1]],
    [k(','), ['stepFrame', -1]],
    [k('.'), ['stepFrame', 1]],
    [k('-'), ['rateStep', -1]],
    [k('='), ['rateStep', 1]],
    [k('['), ['markStart']],
    [k(']'), ['markEnd']],
    [k('g'), ['cycleGap']],
    [k('t'), ['tapTempo']],
    [k('T'), ['tapTempo']],
    [k('t', { inInput: true }), null],
    [k('m'), ['toggleFlip', 'mirror']],
    [k('r'), ['toggleFlip', 'rotate']],
    [k('Delete'), ['deleteSection']],
    [k('Backspace'), ['deleteSection']],
    [k('x'), null],
    [k(' ', { inInput: true }), null],
    [k('r', { metaKey: true }), null],
    [k('l', { ctrlKey: true }), null],
  ])('%o → %o', (input, expected) => {
    expect(keyToCommand(input)).toEqual(expected);
  });
});
