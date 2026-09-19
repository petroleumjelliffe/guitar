import { commands, store } from '../app';

export function Notice() {
  const notice = store.notice.value;
  const error = store.error.value;
  if (!notice && !error && !store.linkDiffers.value && !store.storageWarning.value) return null;
  return (
    <div class="notices">
      {error && (
        <div class="notice notice-error">
          {error}{' '}
          {store.lesson.value && (
            <a href={`https://www.youtube.com/watch?v=${store.lesson.value.videoId}`} target="_blank" rel="noreferrer">
              Open on YouTube
            </a>
          )}
        </div>
      )}
      {store.linkDiffers.value && (
        <div class="notice">
          Loaded from link — your saved version differs.{' '}
          <button onClick={() => commands.restoreSaved()}>Restore saved</button>
        </div>
      )}
      {store.storageWarning.value && (
        <div class="notice">Browser storage is unavailable; changes won't be saved after you leave.</div>
      )}
      {notice && (
        <div class="notice">
          {notice.text}{' '}
          {notice.action && <button onClick={notice.action.run}>{notice.action.label}</button>}
          <button class="link" onClick={() => commands.dismissNotice()}>Dismiss</button>
        </div>
      )}
    </div>
  );
}
