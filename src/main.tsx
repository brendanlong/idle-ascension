import { render } from 'preact';
import { App } from './ui/App';
import { game } from './ui/game';
import './ui/styles.css';

game.start();
render(<App />, document.getElementById('app')!);
