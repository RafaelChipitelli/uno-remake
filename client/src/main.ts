import Phaser from 'phaser';
import { createGameConfig } from './config/phaser';
import './style.css';

const game = new Phaser.Game(createGameConfig());

const resize = () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
  game.scale.refresh();
};

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);



