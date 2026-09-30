import { render } from 'preact';
import { App } from './ui/App';
import { loadAnalytics } from './ui/analytics';
import { game } from './ui/game';
import './ui/styles.css';

game.start();
loadAnalytics();
render(<App />, document.getElementById('app')!);
