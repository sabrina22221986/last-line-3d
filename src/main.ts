import './style.css';
import { Game } from './game/Game';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('找不到游戏容器');

const game = new Game(app);
game.start();
