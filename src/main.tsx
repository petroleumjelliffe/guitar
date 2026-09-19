import { render } from 'preact';
import { commands } from './app';
import { installHotkeys } from './commands/hotkeys';
import { App } from './ui/App';
import './app.css';

commands.openFromHash(location.hash);
window.addEventListener('hashchange', () => {
  // Only react to hashes we did not write ourselves (replaceState does not fire hashchange).
  commands.openFromHash(location.hash);
});
installHotkeys(commands);

render(<App />, document.getElementById('app')!);
