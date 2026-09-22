import { describe, expect, test } from 'vitest';
import { focusSwallows, keyToCommand, type FocusTarget, type KeyInput } from './hotkeys';

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
    [k('g'), ['cycleCountIn']],
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

const target = (over: Partial<FocusTarget>): FocusTarget => ({
  tagName: 'DIV', isContentEditable: false, focusVisible: false, ...over,
});

describe('focusSwallows', () => {
  test('null target never swallows', () => {
    expect(focusSwallows(null, ' ')).toBe(false);
  });
  test('text input swallows any key', () => {
    const t = target({ tagName: 'INPUT', type: 'text' });
    expect(focusSwallows(t, ' ')).toBe(true);
    expect(focusSwallows(t, 'l')).toBe(true);
    expect(focusSwallows(t, 'Enter')).toBe(true);
  });
  test('input type=range does not swallow', () => {
    const t = target({ tagName: 'INPUT', type: 'range' });
    expect(focusSwallows(t, ' ')).toBe(false);
    expect(focusSwallows(t, '[')).toBe(false);
  });
  test('textarea swallows any key', () => {
    expect(focusSwallows(target({ tagName: 'TEXTAREA' }), ' ')).toBe(true);
  });
  test('contentEditable element swallows any key', () => {
    expect(focusSwallows(target({ tagName: 'DIV', isContentEditable: true }), 'l')).toBe(true);
  });
  test('button without :focus-visible does not swallow Space', () => {
    expect(focusSwallows(target({ tagName: 'BUTTON', focusVisible: false }), ' ')).toBe(false);
  });
  test('button focused by keyboard swallows Space and Enter, not other keys', () => {
    const t = target({ tagName: 'BUTTON', focusVisible: true });
    expect(focusSwallows(t, ' ')).toBe(true);
    expect(focusSwallows(t, 'Enter')).toBe(true);
    expect(focusSwallows(t, 'l')).toBe(false);
  });
  test('role=radio focused by keyboard swallows Space', () => {
    expect(focusSwallows(target({ tagName: 'DIV', role: 'radio', focusVisible: true }), ' ')).toBe(true);
  });
  test('role=button div and link focused by keyboard swallow Space/Enter, not other keys', () => {
    const block = target({ tagName: 'DIV', role: 'button', focusVisible: true });
    expect(focusSwallows(block, ' ')).toBe(true);
    expect(focusSwallows(block, 'Enter')).toBe(true);
    expect(focusSwallows(block, 'l')).toBe(false);
    expect(focusSwallows(target({ tagName: 'A', focusVisible: true }), 'Enter')).toBe(true);
    expect(focusSwallows(target({ tagName: 'A', focusVisible: false }), 'Enter')).toBe(false);
  });
});
