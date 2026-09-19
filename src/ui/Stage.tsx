import { useEffect, useRef } from 'preact/hooks';
import { commands, store } from '../app';
import { YouTubePlayer } from '../player/youtube';

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

  const transform = [store.mirror.value ? 'scaleX(-1)' : '', store.rotate.value ? 'rotate(180deg)' : '']
    .join(' ')
    .trim();

  return (
    <div class="stage">
      <div class="stage-video" style={{ transform }} ref={wrap} />
      <div class="stage-overlay" onClick={() => commands.togglePlay()} title="Click to play / pause" />
    </div>
  );
}
