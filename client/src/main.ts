import Phaser from 'phaser';
import { createGameConfig } from './config/phaser';
import { applyThemeCssVariables } from './theme/tokens';
import './style.css';

applyThemeCssVariables();

new Phaser.Game(createGameConfig());





