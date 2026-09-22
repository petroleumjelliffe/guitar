import { useEffect, useState } from 'preact/hooks';
import { commands, store } from '../app';
import { formatRulerLabel } from './arrange/math';

/** Lesson header across the top of the card: back to the library, title + meta, Share (spec §5.10). */
export function TitleBar() {
  const lesson = store.lesson.value!;
  const duration = store.duration.value;
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const share = () => {
    const url = commands.shareUrl();
    const copy = navigator.clipboard?.writeText(url) ?? Promise.reject(new Error('no clipboard'));
    copy.then(() => setCopied(true)).catch(() => window.prompt('Copy this link', url));
  };

  const n = lesson.sections.length;
  const meta = `${n} ${n === 1 ? 'section' : 'sections'}${duration > 0 ? ` · ${formatRulerLabel(duration)}` : ''}`;

  return (
    <header class="title-bar">
      <button class="panel-key bar-key" onClick={() => commands.closeLesson()} title="Back to the library" aria-label="All lessons">
        <span class="ico" aria-hidden="true">◀</span>
        <span class="txt">All lessons</span>
      </button>
      <div class="title-text">
        <span class="title" title={lesson.title}>{lesson.title}</span>
        <span class="title-meta">{meta}</span>
      </div>
      <button class="panel-key bar-key" onClick={share} title="Copy a link to this lesson" aria-label={copied ? 'Copied' : 'Share'}>
        <span class="txt">{copied ? 'Copied' : 'Share'}</span>
        <span class="ico" aria-hidden="true">⤴</span>
      </button>
    </header>
  );
}
