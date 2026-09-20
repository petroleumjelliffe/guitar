import { DEFAULT_RATES } from '../lesson/model';
import type { PlayerPort, PlayerState } from './port';

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

/** Injects the IFrame API script once. */
export function loadApi(): Promise<void> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve, reject) => {
    if (typeof YT !== 'undefined' && YT.Player) {
      resolve();
      return;
    }
    window.onYouTubeIframeAPIReady = () => resolve();
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => {
      apiPromise = null;
      reject(new Error("Couldn't load the YouTube player. Check your connection."));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

const STATES: Record<number, PlayerState> = {
  [-1]: 'unstarted', // YT.PlayerState.UNSTARTED
  0: 'ended',
  1: 'playing',
  2: 'paused',
  3: 'buffering',
  5: 'unstarted', // CUED
};

export class YouTubePlayer implements PlayerPort {
  private yt!: YT.Player;
  private subs = new Set<() => void>();
  private errSubs = new Set<(code: number) => void>();
  private lastState: PlayerState = 'unstarted';

  private constructor() {}

  /** Replaces `host` with the iframe. Resolves on the player's onReady. */
  static async create(host: HTMLElement, videoId: string): Promise<YouTubePlayer> {
    await loadApi();
    const p = new YouTubePlayer();
    await new Promise<void>((resolve) => {
      p.yt = new YT.Player(host, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { controls: 0, disablekb: 1, rel: 0, playsinline: 1, modestbranding: 1 },
        events: {
          onReady: () => resolve(),
          onStateChange: (e) => {
            p.lastState = STATES[e.data] ?? 'unstarted';
            p.subs.forEach((cb) => cb());
          },
          onError: (e) => p.errSubs.forEach((cb) => cb(e.data)),
        },
      });
    });
    return p;
  }

  currentTime() { return this.yt.getCurrentTime?.() ?? 0; }
  duration() { return this.yt.getDuration?.() ?? 0; }
  seek(seconds: number) { this.yt.seekTo(seconds, true); }
  play() { this.yt.playVideo(); }
  pause() { this.yt.pauseVideo(); }
  // Query the player synchronously so one missed onStateChange event doesn't
  // leave the loop engine believing the video is stuck; fall back to the
  // last known event when the API can't report a current code.
  state() {
    const code = this.yt.getPlayerState?.();
    return (code !== undefined && STATES[code]) || this.lastState;
  }
  setRate(rate: number) { this.yt.setPlaybackRate(rate); }
  rate() { return this.yt.getPlaybackRate?.() ?? 1; }
  // The embed honours setPlaybackRate at intermediate rates (e.g. 0.85), but
  // getAvailablePlaybackRates() still only reports the 8 fixed steps — verified
  // in the Task 2 spikes. Union our known-good rates with whatever it reports.
  availableRates() {
    const reported = this.yt.getAvailablePlaybackRates?.() ?? [];
    return [...new Set([...DEFAULT_RATES, ...reported])].sort((a, b) => a - b);
  }
  onStateChange(cb: () => void) {
    this.subs.add(cb);
    return () => { this.subs.delete(cb); };
  }

  /** Undocumented but stable; empty string if missing. */
  title(): string {
    const data = (this.yt as unknown as { getVideoData?: () => { title?: string } }).getVideoData?.();
    return data?.title ?? '';
  }

  onError(cb: (code: number) => void) {
    this.errSubs.add(cb);
    return () => { this.errSubs.delete(cb); };
  }

  destroy() {
    this.subs.clear();
    this.errSubs.clear();
    this.yt.destroy();
  }
}
