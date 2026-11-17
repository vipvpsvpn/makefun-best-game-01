// Emberkeep's world: the lantern keeper, the shades that hunt the light, the
// embers they drop, and the ten waves between the keeper and dawn. Pure game
// logic — no drawing here. The renderer reads this state; the loop drives it.

import { LOGICAL_W, LOGICAL_H } from './input.js';

export const WAVE_COUNT = 10;
export const FLAME_MAX = 100;
export const FLAME_DRAIN = 0.35;

const SHADE_KINDS = {
  wisp: { hp: 1, speed: 96, r: 14, score: 10, damage: 8, embers: 1, knock: 1 },
  skitter: { hp: 1, speed: 152, r: 11, score: 15, damage: 6, embers: 1, knock: 1 },
  brute: { hp: 3, speed: 56, r: 24, score: 30, damage: 16, embers: 3, knock: 0.25 },
};

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export class World {
  constructor(rng) {
    this.rng = rng;
    this.reset();
  }

  reset() {
    this.time = 0;
    this.player = {
      x: LOGICAL_W / 2,
      y: LOGICAL_H / 2,
      r: 16,
      speed: 268,
      flame: FLAME_MAX,
      flareCd: 0,
      invuln: 0,
      aim: -Math.PI / 2,
      walkPhase: 0,
      moving: false,
    };
    this.shades = [];
    this.embers = [];
    this.particles = [];
    this.texts = [];
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.wave = 0;
    this.waveState = 'between'; // 'between' | 'fighting' | 'done'
    this.waveTimer = 2.2;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.embersCollected = 0;
    this.shadesDefeated = 0;
    this.flaresCast = 0;
    this.won = false;
    this.lost = false;
    this.shake = 0;
    this.flash = 0;
    this.banner = '';
    this.bannerTimer = 0;
    this.demo = false;
  }

  lightRadius() {
    return 150 + this.player.flame * 1.5;
  }

  // --- waves ---------------------------------------------------------------
  waveComposition(n) {
    const list = [];
    const total = 5 + 3 * n;
    for (let i = 0; i < total; i++) list.push('wisp');
    if (n >= 2) {
      const skitters = Math.floor(total * 0.28);
      for (let i = 0; i < skitters; i++) list.push('skitter');
    }
    if (n >= 4) {
      const brutes = 1 + Math.floor((n - 4) / 2);
      for (let i = 0; i < brutes; i++) list.push('brute');
    }
    // Shuffle with the seeded rng so a seed replays the same wave.
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng.next() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  startWave(n, fx) {
    this.wave = n;
    this.spawnQueue = this.waveComposition(n);
    this.spawnTimer = 0.6;
    this.waveState = 'fighting';
    this.banner = `Wave ${n} of ${WAVE_COUNT}`;
    this.bannerTimer = 2.4;
    if (fx && fx.ready()) fx.wave();
  }

  waveCleared(fx) {
    const bonus = 40 + 10 * this.wave;
    this.score += bonus;
    this.addText(this.player.x, this.player.y - 44, `Wave clear  +${bonus}`, '#ffd97a', 22);
    if (this.wave >= WAVE_COUNT) {
      this.won = true;
      this.waveState = 'done';
      if (fx && fx.ready()) fx.victory();
      return;
    }
    this.waveState = 'between';
    this.waveTimer = 3.0;
    this.banner = `Wave ${this.wave} clear  ·  +${bonus}`;
    this.bannerTimer = 2.6;
  }

  // --- spawning ------------------------------------------------------------
  spawnPoint() {
    const edge = this.rng.int(0, 3);
    const m = 40;
    let x;
    let y;
    if (edge === 0) { x = this.rng.range(m, LOGICAL_W - m); y = -m; }
    else if (edge === 1) { x = LOGICAL_W + m; y = this.rng.range(m, LOGICAL_H - m); }
    else if (edge === 2) { x = this.rng.range(m, LOGICAL_W - m); y = LOGICAL_H + m; }
    else { x = -m; y = this.rng.range(m, LOGICAL_H - m); }
    // Keep spawns out of the lantern's light so they creep in from the dark.
    const dx = x - this.player.x;
    const dy = y - this.player.y;
    if (Math.hypot(dx, dy) < this.lightRadius() + 90) {
      x = dx >= 0 ? LOGICAL_W + m : -m;
      y = clamp(this.player.y + this.rng.range(-220, 220), m, LOGICAL_H - m);
    }
    return { x, y };
  }

  spawnShade(kind) {
    const def = SHADE_KINDS[kind];
    const p = this.spawnPoint();
    this.shades.push({
      kind,
      x: p.x,
      y: p.y,
      r: def.r,
      hp: def.hp,
      maxHp: def.hp,
      speed: def.speed * this.rng.range(0.9, 1.15),
      score: def.score,
      damage: def.damage,
      embers: def.embers,
      knock: def.knock,
      wobble: this.rng.angle(),
      wobbleSpeed: this.rng.range(1.2, 2.6),
      lungeTimer: this.rng.range(0.8, 1.8),
      lunging: 0,
      vx: 0,
      vy: 0,
      hitFlash: 0,
    });
  }

  // --- combat --------------------------------------------------------------
  flare(fx) {
    const p = this.player;
    if (p.flareCd > 0) return false;
    p.flareCd = 0.85;
    this.flaresCast += 1;
    const radius = 168;
    const px = p.x + Math.cos(p.aim) * 26;
    const py = p.y + Math.sin(p.aim) * 26;
    this.ring(px, py, radius, '#ffb84d');
    this.burst(px, py, 26, '#ffcf7d', 260);
    this.shake = Math.max(this.shake, 5);
    if (fx && fx.ready()) fx.flare();
    let hitAny = false;
    for (const s of this.shades) {
      const d = Math.hypot(s.x - px, s.y - py);
      if (d < radius + s.r) {
        hitAny = true;
        s.hp -= 1;
        s.hitFlash = 0.18;
        const push = 300 * s.knock;
        const nx = (s.x - px) / (d || 1);
        const ny = (s.y - py) / (d || 1);
        s.vx += nx * push;
        s.vy += ny * push;
        if (s.hp <= 0) this.defeatShade(s, fx);
      }
    }
    if (!hitAny) this.combo = 0;
    return true;
  }

  defeatShade(s, fx) {
    s.dead = true;
    this.shadesDefeated += 1;
    this.combo += 1;
    this.comboTimer = 3;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    const mult = Math.min(5, 1 + Math.floor(this.combo / 4));
    const gained = s.score * mult;
    this.score += gained;
    this.addText(s.x, s.y - s.r - 6, `+${gained}`, mult > 1 ? '#ffe9a8' : '#fff2cf', mult > 1 ? 20 : 16);
    if (this.combo > 0 && this.combo % 4 === 0) {
      this.addText(this.player.x, this.player.y - 52, `Combo x${mult}!`, '#ffb84d', 24);
    }
    this.burst(s.x, s.y, 14, '#c9b8ff', 180);
    this.burst(s.x, s.y, 8, '#8f7bff', 120);
    for (let i = 0; i < s.embers; i++) {
      const a = this.rng.angle();
      this.embers.push({
        x: s.x,
        y: s.y,
        vx: Math.cos(a) * this.rng.range(30, 90),
        vy: Math.sin(a) * this.rng.range(30, 90),
        value: 1,
        life: 14,
        phase: this.rng.angle(),
      });
    }
    if (fx && fx.ready()) fx.shadeDown();
  }

  damagePlayer(amount, fx) {
    const p = this.player;
    if (p.invuln > 0 || this.demo) return;
    p.flame -= amount;
    p.invuln = 0.7;
    this.flash = 0.55;
    this.shake = Math.max(this.shake, 9);
    this.combo = 0;
    this.burst(p.x, p.y, 18, '#ff6b6b', 220);
    if (fx && fx.ready()) fx.hit();
    if (p.flame <= 0) {
      p.flame = 0;
      this.lost = true;
      this.burst(p.x, p.y, 40, '#ffb84d', 320);
      if (fx && fx.ready()) fx.gameover();
    }
  }

  // --- effects -------------------------------------------------------------
  burst(x, y, n, color, speed) {
    for (let i = 0; i < n; i++) {
      const a = this.rng.angle();
      const v = this.rng.range(speed * 0.25, speed);
      this.particles.push({
        kind: 'spark', x, y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: this.rng.range(0.35, 0.8), maxLife: 0.8,
        size: this.rng.range(1.5, 3.5), color,
      });
    }
    if (this.particles.length > 420) this.particles.splice(0, this.particles.length - 420);
  }

  ring(x, y, radius, color) {
    this.particles.push({
      kind: 'ring', x, y, vx: 0, vy: 0,
      life: 0.45, maxLife: 0.45, size: radius, color,
    });
  }

  addText(x, y, str, color, size) {
    this.texts.push({ x, y, str, color, size, life: 1.1, maxLife: 1.1 });
    if (this.texts.length > 24) this.texts.shift();
  }

  // --- per-frame update ----------------------------------------------------
  update(dt, input, fx) {
    this.time += dt;
    const p = this.player;
    if (this.won || this.lost) {
      this.updateFx(dt);
      return;
    }

    // Flame slowly drains: the dark always wants the light back.
    if (!this.demo) {
      p.flame = Math.max(0, p.flame - FLAME_DRAIN * dt);
      if (p.flame <= 0) {
        this.lost = true;
        if (fx && fx.ready()) fx.gameover();
      }
    }
    p.flareCd = Math.max(0, p.flareCd - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    if (this.bannerTimer > 0) this.bannerTimer -= dt;
    this.flash = Math.max(0, this.flash - dt * 1.6);
    this.shake = Math.max(0, this.shake - dt * 26);

    // Movement and aim.
    if (this.demo) {
      this.demoDrive(dt);
    } else {
      const mv = input.moveVector();
      p.moving = mv.x !== 0 || mv.y !== 0;
      p.x = clamp(p.x + mv.x * p.speed * dt, 24, LOGICAL_W - 24);
      p.y = clamp(p.y + mv.y * p.speed * dt, 24, LOGICAL_H - 24);
      if (p.moving) p.walkPhase += dt * 11;
      const dx = input.mouse.x - p.x;
      const dy = input.mouse.y - p.y;
      if (dx * dx + dy * dy > 4) p.aim = Math.atan2(dy, dx);
      const wantFlare = input.mouse.down || input.isDown('Space');
      if (wantFlare) this.flare(fx);
    }
    if (this.demo) {
      const dx = this.demoAim.x - p.x;
      const dy = this.demoAim.y - p.y;
      if (dx * dx + dy * dy > 4) p.aim = Math.atan2(dy, dx);
    }

    // Waves.
    if (this.waveState === 'between') {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) this.startWave(this.demo ? Math.min(this.wave + 1, 3) : this.wave + 1, fx);
    } else if (this.waveState === 'fighting') {
      if (this.spawnQueue.length > 0) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.spawnShade(this.spawnQueue.shift());
          this.spawnTimer = Math.max(0.35, 1.05 - this.wave * 0.06);
        }
      } else if (this.shades.length === 0) {
        this.waveCleared(fx);
      }
    }

    this.updateShades(dt, fx);
    this.updateEmbers(dt, fx);
    this.updateFx(dt);
  }

  updateShades(dt, fx) {
    const p = this.player;
    for (const s of this.shades) {
      if (s.dead) continue;
      s.hitFlash = Math.max(0, s.hitFlash - dt);
      const dx = p.x - s.x;
      const dy = p.y - s.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d;
      const ny = dy / d;
      // A sideways wobble so the drift never looks mechanical.
      const wob = Math.sin(this.time * s.wobbleSpeed + s.wobble) * 0.45;
      let speed = s.speed;
      if (s.kind === 'skitter') {
        s.lungeTimer -= dt;
        if (s.lungeTimer <= 0) {
          s.lunging = 0.45;
          s.lungeTimer = this.rng.range(1.4, 2.2);
        }
        if (s.lunging > 0) {
          s.lunging -= dt;
          speed *= 2.6;
        }
      }
      s.x += (nx * speed + -ny * speed * wob) * dt + s.vx * dt;
      s.y += (ny * speed + nx * speed * wob) * dt + s.vy * dt;
      s.vx *= Math.max(0, 1 - dt * 6);
      s.vy *= Math.max(0, 1 - dt * 6);
      s.x = clamp(s.x, -60, LOGICAL_W + 60);
      s.y = clamp(s.y, -60, LOGICAL_H + 60);
      // Touching the keeper drains the flame.
      if (d < s.r + p.r - 2) this.damagePlayer(s.damage, fx);
    }
    this.shades = this.shades.filter((s) => !s.dead);
  }

  updateEmbers(dt, fx) {
    const p = this.player;
    for (const e of this.embers) {
      e.life -= dt;
      e.phase += dt * 3;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 110) {
        e.vx += (dx / d) * 620 * dt;
        e.vy += (dy / d) * 620 * dt;
      }
      e.vx *= Math.max(0, 1 - dt * 2.2);
      e.vy *= Math.max(0, 1 - dt * 2.2);
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (d < p.r + 10) {
        e.dead = true;
        this.embersCollected += 1;
        this.score += 5;
        if (!this.demo) p.flame = Math.min(FLAME_MAX, p.flame + 1.2);
        this.burst(e.x, e.y, 4, '#ffcf7d', 90);
        if (fx && fx.ready()) fx.ember(this.combo);
      }
    }
    this.embers = this.embers.filter((e) => !e.dead && e.life > 0);
  }

  updateFx(dt) {
    for (const pt of this.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= Math.max(0, 1 - dt * 2.5);
      pt.vy *= Math.max(0, 1 - dt * 2.5);
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= 34 * dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  // The title screen plays itself: the keeper wanders after embers, flares
  // when shades crowd in, and never gets hurt. Same world, no stakes.
  demoDrive(dt) {
    const p = this.player;
    this.demoAim = this.demoAim || { x: p.x, y: p.y - 100 };
    let tx = p.x;
    let ty = p.y;
    let nearest = null;
    let nearestD = Infinity;
    for (const e of this.embers) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < nearestD) { nearestD = d; nearest = e; }
    }
    if (nearest) { tx = nearest.x; ty = nearest.y; }
    else { tx = LOGICAL_W / 2 + Math.cos(this.time * 0.25) * 220; ty = LOGICAL_H / 2 + Math.sin(this.time * 0.33) * 130; }
    let nearShade = null;
    let nearD = Infinity;
    for (const s of this.shades) {
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d < nearD) { nearD = d; nearShade = s; }
    }
    if (nearShade && nearD < 130) {
      tx = p.x + (p.x - nearShade.x) * 0.9;
      ty = p.y + (p.y - nearShade.y) * 0.9;
    }
    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = Math.hypot(dx, dy);
    p.moving = d > 6;
    if (p.moving) {
      p.x = clamp(p.x + (dx / d) * p.speed * 0.8 * dt, 24, LOGICAL_W - 24);
      p.y = clamp(p.y + (dy / d) * p.speed * 0.8 * dt, 24, LOGICAL_H - 24);
      p.walkPhase += dt * 11;
    }
    if (nearShade) {
      this.demoAim = { x: nearShade.x, y: nearShade.y };
      if (nearD < 175) this.flare(null);
    } else {
      this.demoAim = { x: p.x + Math.cos(this.time * 0.5) * 100, y: p.y + Math.sin(this.time * 0.5) * 100 };
    }
  }
}
