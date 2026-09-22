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
  g: ['cycleCountIn'],
  t: ['tapTempo'],
  m: ['toggleFlip', 'mirror'],
  r: ['toggleFlip', 'rotate'],
  Delete: ['deleteSection'],
  Backspace: ['deleteSection'],
};

export interface FocusTarget {
  tagName: string;
  type?: string;
  isContentEditable: boolean;
  focusVisible: boolean;
  role?: string | null;
}

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'url', 'email', 'password', 'number', 'tel']);

/** Which keys the global hotkey layer must leave alone for the focused element. */
export function focusSwallows(target: FocusTarget | null, key: string): boolean {
  if (!target) return false;
  if (target.isContentEditable || target.tagName === 'TEXTAREA') return true;
  if (target.tagName === 'INPUT') return TEXT_INPUT_TYPES.has((target.type ?? 'text').toLowerCase()); // range/checkbox/radio/button do not trap hotkeys
  // A button/link focused *by keyboard* keeps Space/Enter for its own activation;
  // mouse-clicked buttons (no :focus-visible) leave them to the pedal/hotkeys.
  const activatable = target.tagName === 'BUTTON' || target.tagName === 'A' || target.role === 'button' || target.role === 'radio';
  return activatable && target.focusVisible && (key === ' ' || key === 'Enter');
}

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

export function installHotkeys(commands: Commands, target: Window = window): () => void {
  // Re-checking `:focus-visible` live inside the keydown handler is not
  // reliable: Chromium flips its focus-indicator modality to "keyboard" while
  // it is dispatching *any* trusted keyboard event, so a button that was only
  // ever focused by a mouse click reads `:focus-visible` as true for the very
  // Space/Enter keydown we're trying to classify (verified in Chrome DevTools
  // — clicking MARK then pressing Space otherwise re-triggers END instead of
  // falling through to togglePlay). Snapshot the flag once, at `focusin` time
  // — unaffected by any later keydown — and trust that snapshot instead.
  let visibleFocusEl: EventTarget | null = null;
  const onFocusIn = (e: FocusEvent) => {
    const el = e.target as HTMLElement | null;
    visibleFocusEl = el?.matches?.(':focus-visible') ? el : null;
  };
  const onKey = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    const focusTarget: FocusTarget | null = el && {
      tagName: el.tagName,
      type: (el as HTMLInputElement).type,
      isContentEditable: el.isContentEditable,
      focusVisible: el === visibleFocusEl,
      role: el.getAttribute('role'),
    };
    if (focusSwallows(focusTarget, e.key)) return;
    const binding = keyToCommand({
      key: e.key, shiftKey: e.shiftKey, altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, inInput: false,
    });
    if (!binding) return;
    e.preventDefault();
    const [name, ...args] = binding;
    (commands[name] as (...a: unknown[]) => void)(...args);
  };
  target.addEventListener('focusin', onFocusIn);
  target.addEventListener('keydown', onKey);
  return () => {
    target.removeEventListener('focusin', onFocusIn);
    target.removeEventListener('keydown', onKey);
  };
}
