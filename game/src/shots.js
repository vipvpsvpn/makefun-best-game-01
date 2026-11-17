// Deterministic screenshot scenes for Emberkeep. Each shot stages the real
// world — the same update and render code the player sees — from a fixed
// seed and a fixed simulated time, so a screenshot is always the same
// picture of the same game. ?shot=title|play|victory|gameover&seed=N

import { makeRng } from './rng.js';
import { LOGICAL_W, LOGICAL_H } from './input.js';

function playInput(world, tick) {
  // The keeper chases the nearest ember, aims at the nearest shade, and
  // flares when one comes in range: a real mid-fight frame, every time.
  const p = world.player;
  let target = null;
  let bestD = 280;
  for (const e of world.embers) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bestD) { bestD = d; target = e; }
  }
  let nearestShade = null;
  let sd = Infinity;
  for (const s of world.shades) {
    const d = Math.hypot(s.x - p.x, s.y - p.y);
    if (d < sd) { sd = d; nearestShade = s; }
  }
  const aim = nearestShade
    ? { x: nearestShade.x, y: nearestShade.y }
    : { x: p.x, y: p.y - 100 };
  const a = tick * 0.045;
  let mx = LOGICAL_W / 2 + Math.cos(a + 0.6) * 150;
  let my = LOGICAL_H / 2 + Math.sin(a + 0.6) * 100;
  if (target) { mx = target.x; my = target.y; }
  const flare = !!(nearestShade && sd < 175 && tick % 55 < 2);
  return {
    mouse: { x: aim.x, y: aim.y, down: flare },
    isDown: () => flare,
    moveVector: () => {
      const dx = mx - p.x;
      const dy = my - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 8) return { x: 0, y: 0 };
      return { x: dx / d, y: dy / d };
    },
  };
}

function stepWorld(world, input, ticks) {
  for (let i = 0; i < ticks; i++) world.update(1 / 60, input, null);
}

function liven(world, rng) {
  // Make sure the frame is busy: shades closing in where the light can
  // see them, embers on the ground, sparks in the air.
  while (world.shades.length < 9) {
    const kinds = ['wisp', 'wisp', 'skitter', 'brute'];
    world.spawnShade(kinds[Math.floor(rng.next() * kinds.length)]);
    const s = world.shades[world.shades.length - 1];
    const a = rng.angle();
    const d = rng.range(150, 280);
    s.x = Math.max(30, Math.min(LOGICAL_W - 30, world.player.x + Math.cos(a) * d));
    s.y = Math.max(30, Math.min(LOGICAL_H - 30, world.player.y + Math.sin(a) * d));
  }
  while (world.embers.length < 8) {
    const a = rng.angle();
    const d = rng.range(60, 240);
    world.embers.push({
      x: Math.max(30, Math.min(LOGICAL_W - 30, world.player.x + Math.cos(a) * d)),
      y: Math.max(30, Math.min(LOGICAL_H - 30, world.player.y + Math.sin(a) * d)),
      vx: 0, vy: 0, value: 1, life: 14, phase: rng.angle(),
    });
  }
  world.burst(world.player.x + 60, world.player.y - 40, 16, '#ffcf7d', 200);
  world.ring(world.player.x, world.player.y, 150, '#ffb84d');
}

export function stageShot(world, name, seed) {
  const rng = makeRng(seed);
  world.rng = rng;
  world.reset();
  world.time = 0;

  if (name === 'title') {
    world.demo = true;
    stepWorld(world, playInput(world, 0), 60 * 7);
    world.time = 7;
    return true;
  }

  if (name === 'play') {
    world.demo = false;
    // Fight through the opening waves with the scripted keeper, nudging
    // each wave along so the shot lands mid-fight in wave 3.
    world.startWave(1, null);
    for (let tick = 0; tick < 60 * 15; tick++) {
      if ((tick === 60 * 5 || tick === 60 * 10) && world.waveState === 'fighting') {
        world.shades.length = 0;
        world.spawnQueue.length = 0;
        world.waveCleared(null);
        world.waveTimer = 0.01;
      }
      world.update(1 / 60, playInput(world, tick), null);
      if (world.lost) break;
    }
    world.player.flame = Math.max(62, world.player.flame);
    // The HUD already says the wave; a big banner would cover the fight.
    world.banner = '';
    world.bannerTimer = 0;
    world.time = 15;
    liven(world, rng);
    return true;
  }

  if (name === 'victory') {
    world.demo = false;
    world.score = 4860;
    world.embersCollected = 87;
    world.shadesDefeated = 94;
    world.bestCombo = 21;
    world.wave = 10;
    world.time = 8 * 60 + 24;
    world.player.flame = 64;
    world.player.x = 250;
    world.player.y = 560;
    world.won = true;
    liven(world, rng);
    world.time = 8 * 60 + 24;
    return true;
  }

  if (name === 'gameover') {
    world.demo = false;
    world.score = 1730;
    world.embersCollected = 41;
    world.shadesDefeated = 52;
    world.bestCombo = 12;
    world.wave = 6;
    world.time = 4 * 60 + 37;
    world.player.flame = 0;
    world.player.x = 1030;
    world.player.y = 560;
    world.lost = true;
    world.burst(world.player.x, world.player.y, 30, '#ffb84d', 260);
    world.time = 4 * 60 + 37;
    return true;
  }

  return false;
}
