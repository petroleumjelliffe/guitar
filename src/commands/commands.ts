import type { Library } from '../lesson/library';
import { createLesson, type Lesson } from '../lesson/model';
import { decodeLesson, encodeLesson } from '../lesson/url';
import { parseVideoId } from '../lesson/youtubeUrl';
import { LoopEngine, TICK_MS } from '../loop/engine';
import type { PlayerPort } from '../player/port';
import type { Store } from '../state/store';

export interface CommandContext {
  store: Store;
  library: Library;
  setHash(hash: string): void;
  baseUrl: string; // origin + pathname, ends with '/'
  now(): number;
}

export interface Session {
  player: PlayerPort;
  engine: LoopEngine;
}

const SAVE_DEBOUNCE_MS = 300;

export function playerErrorMessage(code: number): string {
  void code; // every documented code (2, 5, 100, 101, 150) gets the same message
  return "This video can't be played here — open it on YouTube.";
}

export function createCommands(ctx: CommandContext) {
  const { store, library } = ctx;
  let session: Session | null = null;
  let tickHandle: ReturnType<typeof setInterval> | null = null;
  let unsubscribe: (() => void) | null = null;
  let saveHandle: ReturnType<typeof setTimeout> | null = null;

  function refreshLibrary() {
    store.library.value = library.list();
    store.storageWarning.value = library.unavailable;
  }

  function setLesson(lesson: Lesson) {
    saveNow();
    store.lesson.value = lesson;
    store.activeSectionId.value = null;
    store.selectedSectionId.value = null;
    store.pendingStart.value = null;
    store.error.value = null;
    store.inputError.value = null;
    session?.engine.deactivate();
    if (session) session.engine.gap = lesson.gap;
    ctx.setHash(encodeLesson(lesson));
  }

  function saveNow() {
    if (saveHandle) clearTimeout(saveHandle);
    saveHandle = null;
    const l = store.lesson.value;
    if (l) library.save(l);
    store.storageWarning.value = library.unavailable;
  }

  function updateLesson(next: Lesson) {
    store.lesson.value = next;
    ctx.setHash(encodeLesson(next));
    if (session) {
      session.engine.gap = next.gap;
      const active = next.sections.find((s) => s.id === store.activeSectionId.value);
      if (active) session.engine.setSection(active);
    }
    if (saveHandle) clearTimeout(saveHandle);
    saveHandle = setTimeout(saveNow, SAVE_DEBOUNCE_MS);
  }

  function syncFromEngine() {
    if (!session) return;
    const { section, looping, gapUntil } = session.engine.state;
    store.activeSectionId.value = section?.id ?? null;
    store.looping.value = looping;
    store.inGap.value = gapUntil !== null;
  }

  function syncFromPlayer() {
    if (!session) return;
    const p = session.player;
    store.currentTime.value = p.currentTime();
    store.playerState.value = p.state();
    store.rate.value = p.rate();
    const d = p.duration();
    if (d > 0) store.duration.value = d;
  }

  const commands = {
    session: () => session,
    refreshLibrary,
    updateLesson,

    openInput(input: string) {
      const id = parseVideoId(input);
      if (!id) {
        store.inputError.value = "That doesn't look like a YouTube link.";
        return;
      }
      commands.openLesson(id);
    },

    openLesson(videoId: string) {
      setLesson(library.get(videoId) ?? createLesson(videoId, videoId, ctx.now()));
      store.linkDiffers.value = false;
    },

    openFromHash(hash: string): boolean {
      if (!hash || hash === '#') return false;
      const r = decodeLesson(hash, ctx.now());
      if (!r.ok) {
        store.error.value = `This link is invalid: ${r.error}.`;
        return false;
      }
      const saved = library.get(r.lesson.videoId);
      const lesson = saved ? { ...r.lesson, title: saved.title } : r.lesson;
      setLesson(lesson);
      store.linkDiffers.value = !!saved && encodeLesson(saved) !== encodeLesson(r.lesson);
      return true;
    },

    restoreSaved() {
      const l = store.lesson.value;
      const saved = l && library.get(l.videoId);
      if (!saved) return;
      setLesson(saved);
      store.linkDiffers.value = false;
    },

    closeLesson() {
      commands.detachPlayer();
      saveNow();
      store.lesson.value = null;
      store.activeSectionId.value = null;
      store.selectedSectionId.value = null;
      store.pendingStart.value = null;
      store.looping.value = false;
      store.inGap.value = false;
      store.linkDiffers.value = false;
      store.notice.value = null;
      store.error.value = null;
      store.currentTime.value = 0;
      store.duration.value = 0;
      ctx.setHash('');
      refreshLibrary();
    },

    attachPlayer(player: PlayerPort, title: string) {
      commands.detachPlayer();
      const engine = new LoopEngine(player, ctx.now);
      session = { player, engine };
      const lesson = store.lesson.value;
      if (lesson) {
        engine.gap = lesson.gap;
        if (title && title !== lesson.title) updateLesson({ ...lesson, title, updatedAt: ctx.now() });
        else saveNow();
      }
      engine.onChange = syncFromEngine;
      store.availableRates.value = player.availableRates();
      syncFromPlayer();
      unsubscribe = player.onStateChange(syncFromPlayer);
      tickHandle = setInterval(() => {
        engine.tick();
        syncFromPlayer();
      }, TICK_MS);
    },

    detachPlayer() {
      if (tickHandle) clearInterval(tickHandle);
      tickHandle = null;
      unsubscribe?.();
      unsubscribe = null;
      session = null;
      store.playerState.value = 'unstarted';
    },

    playerError(code: number) {
      store.error.value = playerErrorMessage(code);
    },

    shareUrl(): string {
      const l = store.lesson.value;
      return l ? ctx.baseUrl + encodeLesson(l) : ctx.baseUrl;
    },
  };

  refreshLibrary();
  return commands;
}

export type Commands = ReturnType<typeof createCommands>;
