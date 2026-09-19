import type { Library } from '../lesson/library';
import {
  createLesson, newId, nudge as nudgeSection, removeSection, roundTime, snapRate, upsertSection,
  type Lesson, type Section,
} from '../lesson/model';
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
  let lastDeleted: Section | null = null;

  const sections = () => store.lesson.value?.sections ?? [];
  const activeSection = () => sections().find((s) => s.id === store.activeSectionId.value) ?? null;
  const selectedOrActive = () =>
    sections().find((s) => s.id === store.selectedSectionId.value) ?? activeSection();
  const activeIndex = () => sections().findIndex((s) => s.id === store.activeSectionId.value);

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

    togglePlay() {
      if (!session) return;
      session.player.state() === 'playing' ? session.player.pause() : session.player.play();
    },

    jumpToSectionId(id: string) {
      const s = sections().find((x) => x.id === id);
      if (!s || !session) return;
      store.selectedSectionId.value = id;
      session.engine.activate(s);
    },

    jumpToSection(n: number) {
      const s = sections()[n - 1];
      if (s) commands.jumpToSectionId(s.id);
    },

    restartSection() {
      if (activeSection()) session?.engine.restart();
      else commands.jumpToSection(1);
    },

    nextSection() {
      const list = sections();
      if (!list.length) return;
      const i = activeIndex();
      commands.jumpToSectionId(list[(i + 1) % list.length]!.id);
    },

    prevSection() {
      const list = sections();
      if (!list.length) return;
      const i = activeIndex();
      const prevIndex = i < 0 ? list.length - 1 : (i - 1 + list.length) % list.length;
      commands.jumpToSectionId(list[prevIndex]!.id);
    },

    toggleLoop() {
      session?.engine.toggleLoop();
    },

    seekTo(seconds: number) {
      session?.engine.seekTo(seconds);
    },

    seekBy(delta: number) {
      session?.engine.seekBy(delta);
    },

    stepFrame(dir: -1 | 1) {
      session?.engine.stepFrame(dir);
    },

    setRate(rate: number) {
      if (!session) return;
      const snapped = snapRate(rate, session.player.availableRates());
      session.player.setRate(snapped);
      store.rate.value = snapped;
      const l = store.lesson.value;
      const active = activeSection();
      if (l && active && active.rate !== snapped) {
        updateLesson(upsertSection(l, { ...active, rate: snapped }, ctx.now()));
      }
    },

    rateStep(dir: -1 | 1) {
      if (!session) return;
      const rates = session.player.availableRates();
      const i = rates.indexOf(snapRate(session.player.rate(), rates));
      const next = rates[Math.max(0, Math.min(rates.length - 1, i + dir))];
      if (next !== undefined) commands.setRate(next);
    },

    markStart() {
      if (!session) return;
      store.pendingStart.value = roundTime(session.player.currentTime());
    },

    markEnd() {
      const l = store.lesson.value;
      if (!l || !session) return;
      const end = roundTime(session.player.currentTime());
      const pending = store.pendingStart.value;
      if (pending !== null) {
        const section: Section = {
          id: newId(), name: `Section ${l.sections.length + 1}`, start: pending, end, rate: session.player.rate(),
        };
        updateLesson(upsertSection(l, section, ctx.now()));
        store.pendingStart.value = null;
        commands.jumpToSectionId(section.id);
        return;
      }
      const active = activeSection();
      if (active) updateLesson(upsertSection(l, { ...active, end }, ctx.now()));
    },

    nudge(edge: 'start' | 'end', delta: number) {
      const l = store.lesson.value;
      const target = selectedOrActive();
      if (!l || !target) return;
      const moved = nudgeSection(target, edge, delta);
      if (moved) updateLesson(upsertSection(l, moved, ctx.now()));
    },

    setGap(seconds: number) {
      const l = store.lesson.value;
      if (l) updateLesson({ ...l, gap: seconds, updatedAt: ctx.now() });
    },

    cycleGap() {
      const g = store.lesson.value?.gap ?? 0;
      commands.setGap((g + 1) % 4);
    },

    toggleMirror() { store.mirror.value = !store.mirror.value; },
    toggleRotate() { store.rotate.value = !store.rotate.value; },

    selectSection(id: string | null) {
      store.selectedSectionId.value = id;
    },

    renameSection(id: string, name: string) {
      const l = store.lesson.value;
      const s = sections().find((x) => x.id === id);
      if (l && s) updateLesson(upsertSection(l, { ...s, name }, ctx.now()));
    },

    deleteSection(id = store.selectedSectionId.value ?? store.activeSectionId.value) {
      const l = store.lesson.value;
      const s = id && sections().find((x) => x.id === id);
      if (!l || !s) return;
      lastDeleted = s;
      if (store.activeSectionId.value === s.id) session?.engine.deactivate();
      if (store.selectedSectionId.value === s.id) store.selectedSectionId.value = null;
      updateLesson(removeSection(l, s.id, ctx.now()));
      store.notice.value = { text: `Deleted "${s.name}"`, action: { label: 'Undo', run: commands.undoDelete } };
    },

    undoDelete() {
      const l = store.lesson.value;
      if (!l || !lastDeleted) return;
      updateLesson(upsertSection(l, lastDeleted, ctx.now()));
      store.selectedSectionId.value = lastDeleted.id;
      lastDeleted = null;
      store.notice.value = null;
    },

    dismissNotice() {
      store.notice.value = null;
    },
  };

  refreshLibrary();
  return commands;
}

export type Commands = ReturnType<typeof createCommands>;
