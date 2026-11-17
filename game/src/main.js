// Emberkeep's entry point: canvas setup, the state machine (title, playing,
// paused, victory, gameover), the fixed-step loop, buttons, and the ?shot=
// scenes the screenshots are taken from. The game itself lives in world.js
// and render.js; this file only wires them together.

import { LOGICAL_W, LOGICAL_H, Input } from './input.js';
import { makeRng } from './rng.js';
import { AudioEngine } from './audio.js';
import { World } from './world.js';
import { render, buttonsFor } from './render.js';
import { stageShot } from './shots.js';

const BEST_KEY = 'emberkeep.best';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const shotSeed = Number(params.get('seed') || 1) || 1;

const input = new Input(canvas);
const audio = new AudioEngine();
const world = new World(makeRng((Date.now() % 2147483647) || 7));

const ui = {
  state: 'title',
  best: Number(window.localStorage.getItem(BEST_KEY) || 0) || 0,
  hover: null,
  muted: false,
  showHow: false,
};

function saveBest() {
  if (world.score > ui.best) {
    ui.best = world.score;
    try {
      window.localStorage.setItem(BEST_KEY, String(ui.best));
    } catch {
      // Private mode or no storage: the best score just lives for the run.
    }
  }
}

function startGame() {
  world.reset();
  world.rng = makeRng((Date.now() % 2147483647) || 7);
  ui.state = 'playing';
  ui.showHow = false;
  audio.ensure();
  audio.startMusic();
}

function backToTitle() {
  world.reset();
  world.demo = true;
  ui.state = 'title';
  ui.showHow = false;
}

function hitButton(buttons, x, y) {
  for (const b of buttons) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
  }
  return null;
}

function handleButtons() {
  const click = input.click();
  if (!click && !input.pressed('Enter') && !input.pressed('Space')) return;
  const buttons = buttonsFor(ui.state);
  let id = null;
  if (click) id = hitButton(buttons, click.x, click.y);
  if (!id && (input.pressed('Enter') || input.pressed('Space'))) {
    if (ui.state === 'title') id = 'start';
    else if (ui.state === 'victory' || ui.state === 'gameover') id = 'again';
    else if (ui.state === 'paused') id = 'resume';
  }
  if (!id && ui.showHow && click) {
    ui.showHow = false;
    return;
  }
  if (!id) return;
  audio.ensure();
  audio.click();
  if (id === 'start' || id === 'again' || id === 'restart') startGame();
  else if (id === 'how') ui.showHow = true;
  else if (id === 'resume') ui.state = 'playing';
}

function step(dt) {
  // Hover state for buttons, from the mouse position.
  const buttons = buttonsFor(ui.state);
  ui.hover = null;
  for (const b of buttons) {
    if (input.mouse.x >= b.x && input.mouse.x <= b.x + b.w &&
        input.mouse.y >= b.y && input.mouse.y <= b.y + b.h) {
      ui.hover = b.id;
    }
  }

  if (input.pressed('KeyM')) {
    ui.muted = !ui.muted;
    audio.setMuted(ui.muted);
  }
  if (input.pressed('KeyR') && ui.state !== 'title') startGame();

  if (ui.state === 'title') {
    world.demo = true;
    world.update(dt, input, audio);
    handleButtons();
  } else if (ui.state === 'playing') {
    if (input.pressed('KeyP') || input.pressed('Escape')) {
      ui.state = 'paused';
    } else {
      world.update(dt, input, audio);
      if (world.won) {
        ui.state = 'victory';
        saveBest();
        audio.stopMusic();
      } else if (world.lost) {
        ui.state = 'gameover';
        saveBest();
        audio.stopMusic();
      }
    }
    handleButtons();
  } else if (ui.state === 'paused') {
    if (input.pressed('KeyP') || input.pressed('Escape')) ui.state = 'playing';
    handleButtons();
  } else {
    // victory / gameover: the world idles behind the panel.
    world.update(dt, input, audio);
    handleButtons();
  }
  input.endFrame();
}

// --- main loop: fixed 60 Hz steps, render every animation frame ----------
let last = performance.now();
let acc = 0;
const STEP = 1 / 60;

function frame(now) {
  let elapsed = (now - last) / 1000;
  last = now;
  if (elapsed > 0.25) elapsed = 0.25;
  acc += elapsed;
  let guard = 0;
  while (acc >= STEP && guard < 5) {
    step(STEP);
    acc -= STEP;
    guard += 1;
  }
  render(ctx, world, ui, now / 1000);
  requestAnimationFrame(frame);
}

// --- deterministic screenshots -------------------------------------------
if (shotName) {
  // The shot scenes stage the world, render one frame, then raise the flag
  // the screenshot tool waits for. No music, no input, no clock: the same
  // seed always draws the same picture.
  ui.state = shotName === 'title' ? 'title' : shotName === 'play' ? 'playing' : shotName;
  if (shotName === 'victory' || shotName === 'gameover') ui.state = shotName;
  if (shotName === 'play') ui.state = 'playing';
  const ok = stageShot(world, shotName, shotSeed);
  if (ok) {
    ui.best = shotName === 'victory' ? 4860 : shotName === 'gameover' ? 2140 : 2140;
    render(ctx, world, ui, world.time || 0);
    window.__shotReady = true;
  } else {
    document.title = `Unknown shot: ${shotName}`;
  }
} else {
  world.demo = true;
  requestAnimationFrame(frame);
}

// A small handle for play-testing: state, score and a way to force the end
// screens. It changes nothing about the game itself.
window.__emberkeep = {
  get state() { return ui.state; },
  get score() { return world.score; },
  get wave() { return world.wave; },
  get flame() { return Math.round(world.player.flame); },
  get shades() { return world.shades.length; },
  get embers() { return world.embers.length; },
  get best() { return ui.best; },
  start: () => startGame(),
  win: () => { world.won = true; },
  lose: () => { world.lost = true; },
};
