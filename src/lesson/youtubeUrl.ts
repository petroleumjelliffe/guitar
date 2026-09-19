const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Accepts a watch/short/embed/live/youtu.be URL or a bare 11-char ID. */
export function parseVideoId(input: string): string | null {
  const s = input.trim();
  if (VIDEO_ID.test(s)) return s;

  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  let id: string | null = null;

  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1] ?? null;
  } else if (host === 'youtube.com') {
    if (url.pathname === '/watch') {
      id = url.searchParams.get('v');
    } else {
      const m = url.pathname.match(/^\/(embed|shorts|live|v)\/([^/?]+)/);
      id = m?.[2] ?? null;
    }
  }
  return id && VIDEO_ID.test(id) ? id : null;
}
