import { createCommands } from './commands/commands';
import { Library, type StorageLike } from './lesson/library';
import { createStore } from './state/store';

function safeLocalStorage(): StorageLike | null {
  try {
    const s = window.localStorage;
    s.getItem('looplesson:probe');
    return s;
  } catch {
    return null;
  }
}

export const store = createStore();
export const library = new Library(safeLocalStorage());
export const commands = createCommands({
  store,
  library,
  setHash: (hash) => history.replaceState(null, '', hash || location.pathname),
  baseUrl: location.origin + location.pathname,
  now: () => Date.now(),
});
