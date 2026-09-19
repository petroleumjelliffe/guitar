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
});

describe('updateLesson', () => {
  test('debounces the library save by 300 ms and updates the hash', () => {
    commands.openLesson(ID);
    commands.updateLesson({ ...store.lesson.value!, gap: 1 });
    expect(library.get(ID)).toBeUndefined();
    vi.advanceTimersByTime(299);
    expect(library.get(ID)).toBeUndefined();
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
  test('playerError sets a message', () => {
    commands.playerError(150);
    expect(store.error.value).toMatch(/can't be played here/);
  });
});
