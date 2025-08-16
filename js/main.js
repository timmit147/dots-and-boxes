// Entry point. Imports modules and initializes after DOM is ready.
import './firebase.js'; // initializes Firebase (no UI)
import { initAuthUI } from './modules/auth.js';
import { initMenu } from './modules/menu.js';
import { initGame } from './modules/game.js';

function boot() {
  initMenu();
  initAuthUI();
  initGame();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}