import { useEffect, useRef } from 'preact/hooks';
import { commands, store } from '../app';
import { YouTubePlayer } from '../player/youtube';
import { VideoOverlay } from './VideoOverlay';

export function Stage({ videoId }: { videoId: string }) {
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let player: YouTubePlayer | null = null;
    const host = document.createElement('div');
    wrap.current!.appendChild(host);

    YouTubePlayer.create(host, videoId)
      .then((p) => {
        if (cancelled) {
          p.destroy();
          return;
        }
        player = p;
        p.onError((code) => commands.playerError(code));
        commands.attachPlayer(p, p.title());
      })
      .catch((err: Error) => {
        store.error.value = err.message;
      });

    return () => {
      cancelled = true;
      commands.detachPlayer();
      player?.destroy();
      wrap.current?.replaceChildren();
    };
  }, [videoId]);

  const transform = { normal: '', mirror: 'scaleX(-1)', rotate: 'rotate(180deg)' }[store.flip.value];

  return (
    <div class="stage">
      <div class="stage-video" style={{ transform }} ref={wrap} />
      <div class="stage-overlay" onClick={() => commands.togglePlay()} title="Click to play / pause" />
      <VideoOverlay />
    </div>
  );
}
