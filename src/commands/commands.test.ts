import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Library, type StorageLike } from '../lesson/library';
import { createLesson, upsertSection } from '../lesson/model';
import { encodeLesson } from '../lesson/url';
import { FakePlayer } from '../player/fake';
import { createStore, type Store } from '../state/store';
import { createCommands, type Commands } from './commands';

const ID = 'dQw4w9WgXcQ';

class MemStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
}

let store: Store;
let library: Library;
let hashes: string[];
let commands: Commands;
let player: FakePlayer;

beforeEach(() => {
  vi.useFakeTimers();
  store = createStore();
  library = new Library(new MemStorage());
  hashes = [];
  commands = createCommands({
    store, library, setHash: (h) => hashes.push(h), baseUrl: 'https://x.test/', now: () => 1_000,
  });
  player = new FakePlayer();
});
afterEach(() => vi.useRealTimers());

describe('openInput / openLesson', () => {
  test('rejects a bad link', () => {
    commands.openInput('nope');
    expect(store.inputError.value).toMatch(/YouTube/);
    expect(store.lesson.value).toBeNull();
  });
  test('creates a fresh lesson and sets the hash', () => {
    commands.openInput(`https://youtu.be/${ID}`);
    expect(store.lesson.value?.videoId).toBe(ID);
    expect(store.inputError.value).toBeNull();
    expect(hashes.at(-1)).toBe(`#v=1&id=${ID}`);
  });
  test('loads the saved lesson when one exists', () => {
    library.save({ ...createLesson(ID, 'Saved'), gap: 3 });
    commands.openLesson(ID);
    expect(store.lesson.value?.gap).toBe(3);
  });
});

describe('openFromHash', () => {
  test('returns false and does nothing for an empty hash', () => {
    expect(commands.openFromHash('')).toBe(false);
    expect(store.lesson.value).toBeNull();
  });
  test('shows an error for a bad hash', () => {
    expect(commands.openFromHash('#v=9')).toBe(false);
    expect(store.error.value).toMatch(/invalid/i);
  });
  test('loads the link and flags when it differs from the saved copy', () => {
    library.save(upsertSection(createLesson(ID, 'Saved'), { id: 'a', name: 'A', start: 0, end: 5, rate: 1 }));
    expect(commands.openFromHash(`#v=1&id=${ID}&g=2`)).toBe(true);
    expect(store.lesson.value?.gap).toBe(2);
    expect(store.lesson.value?.title).toBe('Saved');
    expect(store.linkDiffers.value).toBe(true);
  });
  test('does not flag when the link matches the saved copy', () => {
    const saved = { ...createLesson(ID, 'Saved'), gap: 2 };
    library.save(saved);
    commands.openFromHash(encodeLesson(saved));
    expect(store.linkDiffers.value).toBe(false);
  });
  test('restoreSaved swaps back to the library copy', () => {
    library.save({ ...createLesson(ID, 'Saved'), gap: 3 });
    commands.openFromHash(`#v=1&id=${ID}&g=2`);
    commands.restoreSaved();
    expect(store.lesson.value?.gap).toBe(3);
    expect(store.linkDiffers.value).toBe(false);
  });
  test('attaching a player does not overwrite the saved copy; restoreSaved still works', () => {
    library.save(upsertSection(createLesson(ID, 'Saved'), { id: 'a', name: 'A', start: 0, end: 5, rate: 1 }));
    commands.openFromHash(`#v=1&id=${ID}&g=2`);
    commands.attachPlayer(player, 'Real title');
    vi.advanceTimersByTime(300);
    expect(library.get(ID)?.sections).toHaveLength(1);
    commands.restoreSaved();
    expect(store.lesson.value?.sections).toHaveLength(1);
    expect(store.linkDiffers.value).toBe(false);
  });
  test('the first edit after a link load overwrites the saved copy and clears the notice', () => {
    library.save({ ...createLesson(ID, 'Saved'), gap: 3 });
    commands.openFromHash(`#v=1&id=${ID}&g=2`);
    commands.updateLesson({ ...store.lesson.value!, gap: 1 });
    vi.advanceTimersByTime(300);
    expect(library.get(ID)?.gap).toBe(1);
    expect(store.linkDiffers.value).toBe(false);
  });
});

describe('updateLesson', () => {
  test('debounces the library save by 300 ms and updates the hash', () => {
    commands.openLesson(ID);
    const hashesBefore = hashes.length;
    commands.updateLesson({ ...store.lesson.value!, gap: 1 });
    expect(library.get(ID)).toBeUndefined();
    expect(hashes.length).toBe(hashesBefore); // hash not written before the timer fires
    vi.advanceTimersByTime(299);
    expect(library.get(ID)).toBeUndefined();
    expect(hashes.length).toBe(hashesBefore);
    vi.advanceTimersByTime(1);
    expect(library.get(ID)?.gap).toBe(1);
    expect(hashes.at(-1)).toBe(`#v=1&id=${ID}&g=1`);
  });
  test('flushes a pending save before switching lessons', () => {
    commands.openLesson(ID);
    commands.updateLesson({ ...store.lesson.value!, gap: 1 });
    commands.openLesson('bbbbbbbbbbb');
    expect(library.get(ID)?.gap).toBe(1);
    vi.advanceTimersByTime(300);
    expect(library.get('bbbbbbbbbbb')).toBeUndefined();
  });
});

describe('attachPlayer / detachPlayer', () => {
  test('copies player state into the store on every tick', () => {
    commands.openLesson(ID);
    commands.attachPlayer(player, 'Real title');
    expect(store.lesson.value?.title).toBe('Real title');
    expect(store.duration.value).toBe(300);
    player.play();
    player.time = 12.5;
    player.r = 0.5;
    vi.advanceTimersByTime(50);
    expect(store.currentTime.value).toBe(12.5);
    expect(store.playerState.value).toBe('playing');
    expect(store.rate.value).toBe(0.5);
    commands.detachPlayer();
    player.time = 99;
    vi.advanceTimersByTime(50);
    expect(store.currentTime.value).toBe(12.5);
    expect(commands.session()).toBeNull();
  });
  test('applies the lesson gap to the engine', () => {
    library.save({ ...createLesson(ID), gap: 2 });
    commands.openLesson(ID);
    commands.attachPlayer(player, '');
    expect(commands.session()?.engine.gap).toBe(2);
  });
  test('re-attaching a player syncs the store from the fresh engine (loop resets)', () => {
    library.save({ ...createLesson(ID), gap: 2 });
    commands.openLesson(ID);
    commands.attachPlayer(player, '');
    commands.toggleLoop();
    expect(store.looping.value).toBe(true);
    commands.attachPlayer(new FakePlayer(), '');
    expect(store.looping.value).toBe(false);
  });
  test('keeps the existing title when the player has none', () => {
    library.save(createLesson(ID, 'Saved'));
    commands.openLesson(ID);
    commands.attachPlayer(player, '');
    expect(store.lesson.value?.title).toBe('Saved');
  });
});

describe('closeLesson', () => {
  test('clears state, hash and refreshes the library list', () => {
    commands.openLesson(ID);
    commands.attachPlayer(player, 'T');
    vi.advanceTimersByTime(300);
    commands.closeLesson();
    expect(store.lesson.value).toBeNull();
    expect(hashes.at(-1)).toBe('');
    expect(store.library.value.map((l) => l.videoId)).toEqual([ID]);
    expect(commands.session()).toBeNull();
  });
});

describe('shareUrl / playerError', () => {
  test('shareUrl is base + hash', () => {
    commands.openLesson(ID);
    expect(commands.shareUrl()).toBe(`https://x.test/#v=1&id=${ID}`);
  });
  test.each([
    [101, /embedding.*signed in.*\(error 101\)/],
    [150, /embedding.*signed in.*\(error 150\)/],
    [100, /not found.*\(error 100\)/],
    [2, /invalid.*\(error 2\)/i],
    [5, /player error.*\(error 5\)/],
    [999, /can't be played here.*\(error 999\)/],
  ])('playerError(%i) sets a code-specific message', (code, pattern) => {
    commands.playerError(code);
    expect(store.error.value).toMatch(pattern);
  });
});

function openWithPlayer(sections: Array<[string, number, number, number?]> = []) {
  let l = createLesson(ID, 'T', 1);
  for (const [name, start, end, rate] of sections) {
    l = upsertSection(l, { id: name.toLowerCase(), name, start, end, rate: rate ?? 1 }, 1);
  }
  library.save(l);
  commands.openLesson(ID);
  commands.attachPlayer(player, 'T');
  player.calls = [];
}

describe('playback commands', () => {
  test('togglePlay', () => {
    openWithPlayer();
    commands.togglePlay();
    commands.togglePlay();
    expect(player.calls).toEqual(['play', 'pause']);
  });
  test('jumpToSection activates and selects', () => {
    openWithPlayer([['A', 10, 20, 0.5], ['B', 30, 40]]);
    commands.jumpToSection(2);
    expect(player.calls).toEqual(['rate:1', 'seek:30', 'play']);
    expect(store.activeSectionId.value).toBe('b');
    expect(store.selectedSectionId.value).toBe('b');
  });
  test('jumpToSection ignores out-of-range', () => {
    openWithPlayer([['A', 10, 20]]);
    commands.jumpToSection(5);
    expect(player.calls).toEqual([]);
  });
  test('restartSection with nothing active jumps to the first section', () => {
    openWithPlayer([['A', 10, 20]]);
    commands.restartSection();
    expect(store.activeSectionId.value).toBe('a');
    player.calls = [];
    player.time = 15;
    commands.restartSection();
    expect(player.calls).toEqual(['seek:10', 'play']);
  });
  test('nextSection and prevSection wrap', () => {
    openWithPlayer([['A', 10, 20], ['B', 30, 40]]);
    commands.nextSection();
    expect(store.activeSectionId.value).toBe('a');
    commands.nextSection();
    expect(store.activeSectionId.value).toBe('b');
    commands.nextSection();
    expect(store.activeSectionId.value).toBe('a');
    commands.prevSection();
    expect(store.activeSectionId.value).toBe('b');
  });
  test('prevSection with nothing active goes to the last section', () => {
    openWithPlayer([['A', 10, 20], ['B', 30, 40]]);
    commands.prevSection();
    expect(store.activeSectionId.value).toBe('b');
  });
  test('toggleLoop reflects in the store', () => {
    openWithPlayer();
    commands.toggleLoop();
    expect(store.looping.value).toBe(true);
  });
  test('seekTo far away clears the active section in the store', () => {
    openWithPlayer([['A', 10, 20]]);
    commands.jumpToSection(1);
    commands.seekTo(100);
    expect(store.activeSectionId.value).toBeNull();
  });
  test('stepFrame only when paused', () => {
    openWithPlayer();
    player.time = 10;
    commands.stepFrame(1);
    expect(player.time).toBeCloseTo(10 + 1 / 30, 6);
  });
});

describe('rate commands', () => {
  test('setRate snaps and persists on the active section', () => {
    openWithPlayer([['A', 10, 20]]);
    commands.jumpToSection(1);
    commands.setRate(0.82);
    expect(player.r).toBe(0.8);
    expect(store.lesson.value?.sections[0]?.rate).toBe(0.8);
  });
  test('setRate without an active section only changes the player', () => {
    openWithPlayer([['A', 10, 20]]);
    commands.setRate(0.5);
    expect(player.r).toBe(0.5);
    expect(store.lesson.value?.sections[0]?.rate).toBe(1);
  });
  test('rateStep moves through available rates and stops at the ends', () => {
    openWithPlayer();
    commands.rateStep(-1);
    expect(player.r).toBe(0.95);
    commands.rateStep(1);
    commands.rateStep(1);
    expect(player.r).toBe(1.25);
    player.r = 2;
    commands.rateStep(1);
    expect(player.r).toBe(2);
  });
});

describe('marking and editing', () => {
  test('markStart then markEnd creates, selects and activates a section', () => {
    openWithPlayer();
    player.r = 0.75;
    player.time = 12.34;
    commands.markStart();
    expect(store.pendingStart.value).toBe(12.3);
    player.time = 20.06;
    commands.markEnd();
    const s = store.lesson.value!.sections[0]!;
    expect(s).toMatchObject({ name: 'Section 1', start: 12.3, end: 20.1, rate: 0.75 });
    expect(store.pendingStart.value).toBeNull();
    expect(store.selectedSectionId.value).toBe(s.id);
    expect(store.activeSectionId.value).toBe(s.id);
    expect(player.calls).toEqual(['rate:0.75', 'seek:12.3', 'play']);
  });
  test('markEnd without a pending start updates the active section end', () => {
    openWithPlayer([['A', 10, 20]]);
    commands.jumpToSection(1);
    player.time = 25;
    commands.markEnd();
    expect(store.lesson.value?.sections[0]?.end).toBe(25);
    expect(commands.session()?.engine.state.section?.end).toBe(25);
  });
  test('markEnd with nothing pending or active does nothing', () => {
    openWithPlayer();
    commands.markEnd();
    expect(store.lesson.value?.sections).toEqual([]);
  });
  test('nudge edits the selected section and ignores invalid moves', () => {
    openWithPlayer([['A', 10, 10.2]]);
    commands.selectSection('a');
    commands.nudge('start', -0.1);
    expect(store.lesson.value?.sections[0]?.start).toBe(9.9);
    commands.nudge('end', -0.2);
    expect(store.lesson.value?.sections[0]?.end).toBe(10.2);
  });
  test('renameSection', () => {
    openWithPlayer([['A', 10, 20]]);
    commands.renameSection('a', 'Intro');
    expect(store.lesson.value?.sections[0]?.name).toBe('Intro');
  });
  test('deleteSection offers undo', () => {
    openWithPlayer([['A', 10, 20]]);
    commands.jumpToSection(1);
    commands.deleteSection('a');
    expect(store.lesson.value?.sections).toEqual([]);
    expect(store.activeSectionId.value).toBeNull();
    expect(store.notice.value?.text).toContain('A');
    store.notice.value!.action!.run();
    expect(store.lesson.value?.sections[0]?.name).toBe('A');
    expect(store.notice.value).toBeNull();
  });
  test('setGap and cycleGap persist and reach the engine', () => {
    openWithPlayer();
    commands.cycleGap();
    commands.cycleGap();
    expect(store.lesson.value?.gap).toBe(2);
    expect(commands.session()?.engine.gap).toBe(2);
    commands.setGap(3);
    commands.cycleGap();
    expect(store.lesson.value?.gap).toBe(0);
  });
  test('mirror and rotate toggle without touching the lesson', () => {
    openWithPlayer();
    const before = store.lesson.value;
    commands.toggleMirror();
    commands.toggleRotate();
    expect(store.mirror.value).toBe(true);
    expect(store.rotate.value).toBe(true);
    expect(store.lesson.value).toBe(before);
  });
});
