import '@fontsource-variable/noto-serif/wght.css';
import '@fontsource-variable/noto-serif/wght-italic.css';
import { render } from 'preact';
import { App } from './ui/App';
import { loadAnalytics } from './ui/analytics';
import { protectInstalledSave } from './ui/install';
import { game } from './ui/game';
import './ui/styles.css';

game.start();
loadAnalytics();
protectInstalledSave();
render(<App />, document.getElementById('app')!);
