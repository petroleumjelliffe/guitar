import { signal, type Signal } from '@preact/signals';
import { DEFAULT_RATES, type Lesson } from '../lesson/model';
import type { LessonSummary } from '../lesson/library';
import type { PlayerState } from '../player/port';

/** How the video is shown: view-only, never saved. */
export type FlipMode = 'normal' | 'mirror' | 'rotate';

export interface Notice {
  text: string;
  action?: { label: string; run: () => void };
}

export interface Store {
  lesson: Signal<Lesson | null>;
  activeSectionId: Signal<string | null>;
  selectedSectionId: Signal<string | null>;
  pendingStart: Signal<number | null>;
  looping: Signal<boolean>;
  inGap: Signal<boolean>;
  playerState: Signal<PlayerState>;
  currentTime: Signal<number>;
  duration: Signal<number>;
  rate: Signal<number>;
  availableRates: Signal<number[]>;
  flip: Signal<FlipMode>;
  library: Signal<LessonSummary[]>;
  linkDiffers: Signal<boolean>;
  inputError: Signal<string | null>;
  error: Signal<string | null>;
  notice: Signal<Notice | null>;
  storageWarning: Signal<boolean>;
}

export function createStore(): Store {
  return {
    lesson: signal(null),
    activeSectionId: signal(null),
    selectedSectionId: signal(null),
    pendingStart: signal(null),
    looping: signal(false),
    inGap: signal(false),
    playerState: signal('unstarted'),
    currentTime: signal(0),
    duration: signal(0),
    rate: signal(1),
    availableRates: signal([...DEFAULT_RATES]),
    flip: signal('normal'),
    library: signal([]),
    linkDiffers: signal(false),
    inputError: signal(null),
    error: signal(null),
    notice: signal(null),
    storageWarning: signal(false),
  };
}
