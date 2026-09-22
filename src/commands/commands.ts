import type { ClickerPort } from '../audio/port';
import type { Library } from '../lesson/library';
import {
  createLesson, createSection, normalizeBpm, nudge as nudgeSection, removeSection, roundTime, snapRate,
  upsertSection, type BeatsPerBar, type CountIn, type Lesson, type Section,
} from '../lesson/model';
import { bpmFromTaps, emptyTaps, tap, type TapState } from '../lesson/tempo';
import { decodeLesson, encodeLesson } from '../lesson/url';
import { parseVideoId } from '../lesson/youtubeUrl';
import { LoopEngine, TICK_MS } from '../loop/engine';
import type { PlayerPort } from '../player/port';
import type { FlipMode, Store } from '../state/store';

export interface CommandContext {
  store: Store;
  library: Library;
  setHash(hash: string): void;
  baseUrl: string; // origin + pathname, ends with '/'
  now(): number;
  createClicker(): ClickerPort;
}

export interface Session {
  player: PlayerPort;
  engine: LoopEngine;
}

const SAVE_DEBOUNCE_MS = 300;

// Codes from the IFrame Player API's onError event.
const PLAYER_ERRORS: Record<number, string> = {
  2: 'Invalid video ID.',
  5: 'YouTube reported a player error.',
  100: 'Video not found — it may be private or removed.',
  101: "YouTube refused to play this video here: either its owner disabled embedding, or YouTube is gating it (turn off any VPN, sign in on youtube.com in another tab, then reload).",
  150: "YouTube refused to play this video here: either its owner disabled embedding, or YouTube is gating it (turn off any VPN, sign in on youtube.com in another tab, then reload).",
};

export function playerErrorMessage(code: number): string {
  const reason = PLAYER_ERRORS[code] ?? "This video can't be played here.";
  return `${reason} (error ${code}) — open it on YouTube instead.`;
}

export function createCommands(ctx: CommandContext) {
  const { store, library } = ctx;
  let session: Session | null = null;
  let tickHandle: ReturnType<typeof setInterval> | null = null;
  let unsubscribe: (() => void) | null = null;
  let saveHandle: ReturnType<typeof setTimeout> | null = null;
  let lastDeleted: Section | null = null;
  // The library copy a share link differed from, kept so `restoreSaved` can
  // bring it back even though `attachPlayer` no longer persists over it.
  // Cleared on the first real edit (`updateLesson`) or on leaving the lesson.
  let savedSnapshot: Lesson | null = null;
  let taps: TapState = emptyTaps();

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
    store.editingSectionId.value = null;
    store.error.value = null;
    store.inputError.value = null;
    session?.engine.deactivate();
    if (session) {
      session.engine.gap = lesson.gap;
      session.engine.countIn = lesson.countIn;
      session.engine.bpm = lesson.bpm;
      session.engine.beatsPerBar = lesson.beatsPerBar;
    }
    ctx.setHash(encodeLesson(lesson));
  }

  function saveNow() {
    if (saveHandle) clearTimeout(saveHandle);
    saveHandle = null;
    // While a share link's un-edited view is on screen (`linkDiffers`), the
    // displayed lesson is not yet a committed edit — never let a flush (e.g.
    // from switching lessons or closing) persist it over the saved copy.
    if (store.linkDiffers.value) return;
    const l = store.lesson.value;
    if (l) library.save(l);
    store.storageWarning.value = library.unavailable;
  }

  function updateLesson(next: Lesson) {
    store.lesson.value = next;
    // The first real edit after opening a share link commits it: the saved
    // copy is legitimately superseded now, so the "differs" notice must go.
    store.linkDiffers.value = false;
    savedSnapshot = null;
    if (session) {
      session.engine.gap = next.gap;
      session.engine.countIn = next.countIn;
      session.engine.bpm = next.bpm;
      session.engine.beatsPerBar = next.beatsPerBar;
      const active = next.sections.find((s) => s.id === store.activeSectionId.value);
      if (active) session.engine.setSection(active);
    }
    if (saveHandle) clearTimeout(saveHandle);
    // Debounce the hash write alongside the save: writing history.replaceState
    // on every keystroke can hit Safari's rate limit, and doing it before the
    // save was scheduled meant a SecurityError there could skip the save too.
    saveHandle = setTimeout(() => {
      saveNow();
      try {
        ctx.setHash(encodeLesson(next));
      } catch {
        // Rate-limited by the browser; the next edit's debounce will retry.
      }
    }, SAVE_DEBOUNCE_MS);
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
      savedSnapshot = null;
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
      const differs = !!saved && encodeLesson(saved) !== encodeLesson(r.lesson);
      store.linkDiffers.value = differs;
      savedSnapshot = differs ? saved! : null;
      return true;
    },

    restoreSaved() {
      const l = store.lesson.value;
      const saved = savedSnapshot ?? (l ? library.get(l.videoId) : undefined);
      if (!saved) return;
      setLesson(saved);
      store.linkDiffers.value = false;
      savedSnapshot = null;
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
      savedSnapshot = null;
      taps = emptyTaps();
      store.tapCount.value = 0;
      store.editingSectionId.value = null;
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
      engine.clicker = ctx.createClicker();
      session = { player, engine };
      const lesson = store.lesson.value;
      if (lesson) {
        engine.gap = lesson.gap;
        engine.countIn = lesson.countIn;
        engine.bpm = lesson.bpm;
        engine.beatsPerBar = lesson.beatsPerBar;
        if (store.linkDiffers.value) {
          // Still showing an un-committed share link: apply the player's
          // title in memory only. Persisting here is exactly the bug that
          // overwrote the saved lesson as soon as the player was ready.
          if (title && title !== lesson.title) store.lesson.value = { ...lesson, title };
        } else if (title && title !== lesson.title) {
          updateLesson({ ...lesson, title, updatedAt: ctx.now() });
        } else {
          saveNow();
        }
      }
      engine.onChange = syncFromEngine;
      store.availableRates.value = player.availableRates();
      syncFromPlayer();
      unsubscribe = player.onStateChange(syncFromPlayer);
      tickHandle = setInterval(() => {
        engine.tick();
        syncFromPlayer();
      }, TICK_MS);
      // Reflect the fresh engine's state (e.g. looping resets to false)
      // instead of leaving the store showing the previous session's values.
      syncFromEngine();
    },

    detachPlayer() {
      session?.engine.clicker?.stop();
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
      session.engine.clicker?.prime();
      session.player.state() === 'playing' ? session.player.pause() : session.player.play();
    },

    jumpToSectionId(id: string) {
      const s = sections().find((x) => x.id === id);
      if (!s || !session) return;
      session.engine.clicker?.prime();
      store.selectedSectionId.value = id;
      session.engine.activate(s);
    },

    jumpToSection(n: number) {
      const s = sections()[n - 1];
      if (s) commands.jumpToSectionId(s.id);
    },

    restartSection() {
      if (activeSection()) {
        session?.engine.clicker?.prime();
        session?.engine.restart();
      } else {
        commands.jumpToSection(1);
      }
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
      session?.engine.clicker?.prime();
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
      // Speed is global and session-only: it lives in the player, never in the lesson.
      session.player.setRate(snapped);
      store.rate.value = snapped;
    },

    rateStep(dir: -1 | 1) {
      if (!session) return;
      const rates = session.player.availableRates();
      const i = rates.indexOf(snapRate(session.player.rate(), rates));
      const next = rates[Math.max(0, Math.min(rates.length - 1, i + dir))];
      if (next !== undefined) commands.setRate(next);
    },

    /** MARK is armed only while the video plays (spec §5.9). */
    markStart() {
      if (!session || session.player.state() !== 'playing') return;
      store.pendingStart.value = roundTime(session.player.currentTime());
    },

    markEnd() {
      const l = store.lesson.value;
      if (!l || !session) return;
      const end = roundTime(session.player.currentTime());
      const pending = store.pendingStart.value;
      if (pending !== null) {
        const section = createSection({
          name: `Section ${l.sections.length + 1}`, start: pending, end,
        });
        updateLesson(upsertSection(l, section, ctx.now()));
        store.pendingStart.value = null;
        // §5.9: pause where we are, select and arm the new section (loop on,
        // no seek), and open its name for editing. The next Play runs the
        // count-in into the section.
        session.player.pause();
        store.selectedSectionId.value = section.id;
        session.engine.arm(section);
        store.editingSectionId.value = section.id;
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

    /** Move one edge to an absolute time (lane drag); same validity rule as nudge. */
    setSectionEdge(id: string, edge: 'start' | 'end', seconds: number) {
      const l = store.lesson.value;
      const s = sections().find((x) => x.id === id);
      if (!l || !s) return;
      const moved = nudgeSection(s, edge, roundTime(seconds) - s[edge]);
      if (moved) updateLesson(upsertSection(l, moved, ctx.now()));
    },

    setCountIn(bars: CountIn) {
      const l = store.lesson.value;
      if (l) updateLesson({ ...l, countIn: bars, updatedAt: ctx.now() });
    },

    cycleCountIn() {
      const c = store.lesson.value?.countIn ?? 1;
      commands.setCountIn(((c + 1) % 3) as CountIn);
    },

    /** Tempo is per lesson: tap any time the player is attached, no section needed. */
    tapTempo() {
      const l = store.lesson.value;
      if (!l || !session) {
        store.notice.value = { text: 'Open a video and press play, then tap on the beat' };
        return;
      }
      taps = tap(taps, ctx.now() * session.player.rate());
      store.tapCount.value = taps.taps.length;
      const bpm = bpmFromTaps(taps);
      if (bpm === null) {
        store.notice.value = { text: `♩ tap ×${taps.taps.length}` };
        return;
      }
      store.notice.value = { text: `♩ ${bpm}` };
      if (bpm !== l.bpm) updateLesson({ ...l, bpm, updatedAt: ctx.now() });
    },

    setBpm(bpm: number) {
      const l = store.lesson.value;
      if (l) updateLesson({ ...l, bpm: normalizeBpm(bpm), updatedAt: ctx.now() });
    },

    nudgeBpm(delta: -1 | 1) {
      const l = store.lesson.value;
      if (!l || l.bpm === 0) return;
      commands.setBpm(l.bpm + delta);
    },

    setBeatsPerBar(n: BeatsPerBar) {
      const l = store.lesson.value;
      if (l) updateLesson({ ...l, beatsPerBar: n, updatedAt: ctx.now() });
    },

    setFlip(mode: FlipMode) { store.flip.value = mode; },
    /** Hotkey behaviour: the mode's key toggles it against normal; any other mode switches to it. */
    toggleFlip(mode: FlipMode) { store.flip.value = store.flip.value === mode ? 'normal' : mode; },

    selectSection(id: string | null) {
      store.selectedSectionId.value = id;
    },

    beginRename(id: string) {
      if (sections().some((s) => s.id === id)) store.editingSectionId.value = id;
    },

    endRename() {
      store.editingSectionId.value = null;
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
      if (store.editingSectionId.value === s.id) store.editingSectionId.value = null;
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
