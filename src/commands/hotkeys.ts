import type { Commands } from './commands';

export interface KeyInput {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  inInput: boolean;
}

type CommandName = keyof Commands;
export type Binding = {
  [K in CommandName]: Commands[K] extends (...a: infer A) => unknown ? [K, ...A] : never;
}[CommandName];

const PLAIN: Record<string, [CommandName, ...unknown[]]> = {
  ' ': ['togglePlay'],
  Enter: ['restartSection'],
  PageUp: ['restartSection'],
  ArrowUp: ['restartSection'],
  PageDown: ['nextSection'],
  ArrowDown: ['nextSection'],
  l: ['toggleLoop'],
  ArrowLeft: ['seekBy', -3],
  ArrowRight: ['seekBy', 3],
  ',': ['stepFrame', -1],
  '.': ['stepFrame', 1],
  '-': ['rateStep', -1],
  '=': ['rateStep', 1],
  '[': ['markStart'],
  ']': ['markEnd'],
  g: ['cycleGap'],
  t: ['tapTempo'],
  m: ['toggleFlip', 'mirror'],
  r: ['toggleFlip', 'rotate'],
  Delete: ['deleteSection'],
  Backspace: ['deleteSection'],
};

export function keyToCommand(k: KeyInput): Binding | null {
  if (k.inInput || k.ctrlKey || k.metaKey) return null;
  const key = k.key.length === 1 ? k.key.toLowerCase() : k.key;

  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const delta = key === 'ArrowLeft' ? -0.1 : 0.1;
    if (k.shiftKey) return ['nudge', 'start', delta] as Binding;
    if (k.altKey) return ['nudge', 'end', delta] as Binding;
  }
  if (k.shiftKey || k.altKey) return null;

  if (/^[1-9]$/.test(key)) return ['jumpToSection', Number(key)] as Binding;
  return (PLAIN[key] ?? null) as Binding | null;
}

const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function installHotkeys(commands: Commands, target: Window = window): () => void {
  const onKey = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    const inInput = !!el && (INPUT_TAGS.has(el.tagName) || el.isContentEditable);
    const binding = keyToCommand({
      key: e.key, shiftKey: e.shiftKey, altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, inInput,
    });
    if (!binding) return;
    e.preventDefault();
    const [name, ...args] = binding;
    (commands[name] as (...a: unknown[]) => void)(...args);
  };
  target.addEventListener('keydown', onKey);
  return () => target.removeEventListener('keydown', onKey);
}
