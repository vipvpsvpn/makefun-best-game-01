// Every pixel of Emberkeep is drawn here: the dark grove, the lantern light
// that pushes it back, the keeper, the shades, the embers, the HUD and all
// four screens. The world only holds state; this file turns it into a scene.

import { LOGICAL_W, LOGICAL_H } from './input.js';
import { mulberry32 } from './rng.js';

// --- fixed scenery, laid out once from a seed so every run looks the same --
function buildScenery() {
  const rng = mulberry32(20261117);
  const fireflies = [];
  for (let i = 0; i < 70; i++) {
    fireflies.push({
      x: rng() * LOGICAL_W,
      y: rng() * LOGICAL_H,
      phase: rng() * Math.PI * 2,
      speed: 0.4 + rng() * 1.1,
      size: 0.8 + rng() * 1.6,
    });
  }
  const speckles = [];
  for (let i = 0; i < 260; i++) {
    speckles.push({ x: rng() * LOGICAL_W, y: rng() * LOGICAL_H, r: 0.6 + rng() * 1.4 });
  }
  const trees = [];
  for (let i = 0; i < 30; i++) {
    const side = i % 4;
    let x;
    let y;
    if (side === 0) { x = rng() * LOGICAL_W; y = -14 - rng() * 26; }
    else if (side === 1) { x = LOGICAL_W + 14 + rng() * 26; y = rng() * LOGICAL_H; }
    else if (side === 2) { x = rng() * LOGICAL_W; y = LOGICAL_H + 14 + rng() * 26; }
    else { x = -14 - rng() * 26; y = rng() * LOGICAL_H; }
    trees.push({ x, y, h: 90 + rng() * 90, w: 42 + rng() * 30, lean: (rng() - 0.5) * 0.24 });
  }
  const stones = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    stones.push({
      x: LOGICAL_W / 2 + Math.cos(a) * 150,
      y: LOGICAL_H / 2 + Math.sin(a) * 108,
      w: 22 + rng() * 14,
      h: 12 + rng() * 8,
      rot: a + Math.PI / 2,
    });
  }
  return { fireflies, speckles, trees, stones };
}

const scenery = buildScenery();
let darkCanvas = null;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Buttons the loop hit-tests: one function, shared by draw and input.
export function buttonsFor(state) {
  if (state === 'title') {
    return [
      { id: 'start', label: 'Kindle the Light', x: 490, y: 516, w: 300, h: 60 },
      { id: 'how', label: 'How to Play', x: 540, y: 592, w: 200, h: 44 },
    ];
  }
  if (state === 'victory' || state === 'gameover') {
    return [
      { id: 'again', label: state === 'victory' ? 'Play Again' : 'Try Again', x: 490, y: 566, w: 300, h: 60 },
    ];
  }
  if (state === 'paused') {
    return [
      { id: 'resume', label: 'Resume', x: 490, y: 400, w: 300, h: 60 },
      { id: 'restart', label: 'Restart', x: 490, y: 476, w: 300, h: 52 },
    ];
  }
  return [];
}

function drawButton(ctx, b, hover) {
  ctx.save();
  ctx.shadowColor = hover ? 'rgba(255, 190, 90, 0.8)' : 'rgba(255, 170, 60, 0.35)';
  ctx.shadowBlur = hover ? 26 : 12;
  const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
  grad.addColorStop(0, hover ? '#8a5a1e' : '#6b4514');
  grad.addColorStop(1, hover ? '#5c3a10' : '#452a0c');
  ctx.fillStyle = grad;
  roundRect(ctx, b.x, b.y, b.w, b.h, 12);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 205, 120, 0.85)';
  ctx.lineWidth = 1.6;
  roundRect(ctx, b.x, b.y, b.w, b.h, 12);
  ctx.stroke();
  ctx.fillStyle = '#ffe9bd';
  ctx.font = `600 ${b.h > 50 ? 24 : 19}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
  ctx.restore();
}

function drawPanel(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(8, 12, 30, 0.88)';
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 200, 110, 0.45)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 16);
  ctx.stroke();
  ctx.restore();
}

// --- the grove -------------------------------------------------------------
function drawBackground(ctx, time) {
  const grad = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
  grad.addColorStop(0, '#0d1330');
  grad.addColorStop(0.55, '#0b1026');
  grad.addColorStop(1, '#070a18');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  ctx.fillStyle = 'rgba(160, 180, 220, 0.16)';
  for (const s of scenery.speckles) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Stone circle at the heart of the grove.
  ctx.save();
  ctx.strokeStyle = 'rgba(120, 140, 190, 0.20)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(LOGICAL_W / 2, LOGICAL_H / 2, 150, 108, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  for (const st of scenery.stones) {
    ctx.save();
    ctx.translate(st.x, st.y);
    ctx.rotate(st.rot);
    ctx.fillStyle = '#232c4a';
    roundRect(ctx, -st.w / 2, -st.h / 2, st.w, st.h, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(180, 200, 240, 0.14)';
    roundRect(ctx, -st.w / 2, -st.h / 2, st.w, st.h / 2, 4);
    ctx.fill();
    ctx.restore();
  }

  // Fireflies drift and blink in the dark.
  for (const f of scenery.fireflies) {
    const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * f.speed + f.phase));
    ctx.fillStyle = `rgba(190, 230, 170, ${0.5 * tw})`;
    ctx.beginPath();
    ctx.arc(f.x + Math.sin(time * 0.3 + f.phase) * 8, f.y + Math.cos(time * 0.23 + f.phase) * 6, f.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pine silhouettes hemming the clearing in.
  for (const t of scenery.trees) {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.lean);
    ctx.fillStyle = '#05070f';
    ctx.beginPath();
    ctx.moveTo(0, -t.h);
    ctx.lineTo(-t.w / 2, 0);
    ctx.lineTo(t.w / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -t.h * 0.72);
    ctx.lineTo(-t.w * 0.62, -t.h * 0.18);
    ctx.lineTo(t.w * 0.62, -t.h * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// The lantern's light: a darkness layer with a hole cut where the keeper
// stands, so the grove is night everywhere except around the flame.
function drawDarkness(ctx, world) {
  if (!darkCanvas) {
    darkCanvas = document.createElement('canvas');
    darkCanvas.width = LOGICAL_W;
    darkCanvas.height = LOGICAL_H;
  }
  const d = darkCanvas.getContext('2d');
  d.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
  d.globalCompositeOperation = 'source-over';
  d.fillStyle = 'rgba(3, 5, 14, 0.8)';
  d.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  d.globalCompositeOperation = 'destination-out';
  const p = world.player;
  const r = world.lightRadius();
  const hole = d.createRadialGradient(p.x, p.y, r * 0.15, p.x, p.y, r);
  hole.addColorStop(0, 'rgba(0,0,0,1)');
  hole.addColorStop(0.7, 'rgba(0,0,0,0.85)');
  hole.addColorStop(1, 'rgba(0,0,0,0)');
  d.fillStyle = hole;
  d.beginPath();
  d.arc(p.x, p.y, r, 0, Math.PI * 2);
  d.fill();
  // Every ember is a small candle in the dark too.
  for (const e of world.embers) {
    const eg = d.createRadialGradient(e.x, e.y, 0, e.x, e.y, 26);
    eg.addColorStop(0, 'rgba(0,0,0,0.9)');
    eg.addColorStop(1, 'rgba(0,0,0,0)');
    d.fillStyle = eg;
    d.beginPath();
    d.arc(e.x, e.y, 26, 0, Math.PI * 2);
    d.fill();
  }
  ctx.drawImage(darkCanvas, 0, 0);
}

// --- entities --------------------------------------------------------------
function drawEmbers(ctx, world, time) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const e of world.embers) {
    const flicker = 0.75 + 0.25 * Math.sin(e.phase * 2.4);
    const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 12);
    g.addColorStop(0, `rgba(255, 210, 120, ${0.95 * flicker})`);
    g.addColorStop(0.4, `rgba(255, 150, 50, ${0.55 * flicker})`);
    g.addColorStop(1, 'rgba(255, 120, 30, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe9b0';
    ctx.beginPath();
    ctx.arc(e.x, e.y, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawShades(ctx, world, time) {
  for (const s of world.shades) {
    const bob = Math.sin(time * 3 + s.wobble) * 2;
    ctx.save();
    ctx.translate(s.x, s.y + bob);
    // A cold violet glow so the shade reads against the night.
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, s.r * 2.1);
    glow.addColorStop(0, s.kind === 'skitter' ? 'rgba(255, 90, 120, 0.28)' : 'rgba(150, 120, 255, 0.3)');
    glow.addColorStop(1, 'rgba(120, 90, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, s.r * 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // Smoky body.
    const body = ctx.createRadialGradient(0, 0, s.r * 0.2, 0, 0, s.r * 1.5);
    if (s.kind === 'brute') {
      body.addColorStop(0, s.hitFlash > 0 ? '#e8e4ff' : '#6b55b8');
      body.addColorStop(0.6, '#3a2f7d');
      body.addColorStop(1, 'rgba(30, 22, 66, 0)');
    } else {
      body.addColorStop(0, s.hitFlash > 0 ? '#efeaff' : '#5d4aa8');
      body.addColorStop(0.6, '#2e2361');
      body.addColorStop(1, 'rgba(22, 16, 50, 0)');
    }
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, s.r * 1.5, 0, Math.PI * 2);
    ctx.fill();
    // Wisp tail.
    if (s.kind !== 'brute') {
      ctx.strokeStyle = 'rgba(170, 150, 255, 0.65)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, s.r * 0.4);
      ctx.quadraticCurveTo(Math.sin(time * 4 + s.wobble) * 10, s.r * 1.2, 0, s.r * 1.7);
      ctx.stroke();
    }
    // Eyes: two cold lights that watch the keeper.
    const eyeY = -s.r * 0.15;
    const eyeDx = s.r * 0.38;
    const eyeR = s.kind === 'brute' ? 4 : 3.2;
    ctx.fillStyle = s.kind === 'skitter' ? '#ff5d7a' : '#d6f2ff';
    ctx.shadowColor = s.kind === 'skitter' ? '#ff5d7a' : '#bfe9ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(-eyeDx, eyeY, eyeR, 0, Math.PI * 2);
    ctx.arc(eyeDx, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Brute health pips.
    if (s.kind === 'brute' && s.hp < s.maxHp) {
      ctx.fillStyle = 'rgba(255, 120, 120, 0.9)';
      for (let i = 0; i < s.hp; i++) {
        ctx.beginPath();
        ctx.arc(-8 + i * 8, -s.r - 8, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

function drawPlayer(ctx, world, time) {
  const p = world.player;
  const bob = p.moving ? Math.sin(p.walkPhase) * 2 : Math.sin(time * 2) * 1.2;
  ctx.save();
  ctx.translate(p.x, p.y + bob * 0.4);

  // Warm halo around the keeper.
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(0, 0, 4, 0, 0, 90);
  halo.addColorStop(0, 'rgba(255, 200, 110, 0.5)');
  halo.addColorStop(1, 'rgba(255, 160, 60, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // Cloak.
  const cloak = ctx.createLinearGradient(0, -16, 0, 18);
  cloak.addColorStop(0, '#7a5a2e');
  cloak.addColorStop(1, '#3d2a12');
  ctx.fillStyle = cloak;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.quadraticCurveTo(13, -6, 14, 14);
  ctx.quadraticCurveTo(0, 20, -14, 14);
  ctx.quadraticCurveTo(-13, -6, 0, -18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 210, 130, 0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.quadraticCurveTo(13, -6, 14, 14);
  ctx.stroke();

  // Hood and face in shadow, lit from the lantern side.
  ctx.fillStyle = '#2c1e0c';
  ctx.beginPath();
  ctx.arc(0, -12, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 220, 150, 0.9)';
  ctx.beginPath();
  ctx.arc(2.5, -11, 2.2, 0, Math.PI * 2);
  ctx.fill();

  // The lantern, held out toward the aim.
  const lx = Math.cos(p.aim) * 24;
  const ly = Math.sin(p.aim) * 24;
  ctx.strokeStyle = '#8a6a2e';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(6, -2);
  ctx.lineTo(lx, ly);
  ctx.stroke();
  ctx.save();
  ctx.translate(lx, ly);
  ctx.fillStyle = '#1c1408';
  roundRect(ctx, -5, -8, 10, 15, 3);
  ctx.fill();
  ctx.strokeStyle = '#d9a94f';
  ctx.lineWidth = 1.4;
  roundRect(ctx, -5, -8, 10, 15, 3);
  ctx.stroke();
  const flame = ctx.createRadialGradient(0, 0, 0, 0, 0, 7);
  flame.addColorStop(0, '#fff6cf');
  flame.addColorStop(0.5, '#ffc44d');
  flame.addColorStop(1, 'rgba(255, 120, 30, 0)');
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Flare cooldown arc around the keeper.
  if (p.flareCd > 0) {
    const frac = 1 - p.flareCd / 0.85;
    ctx.strokeStyle = 'rgba(255, 200, 110, 0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 24, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
  }

  // Hurt blink.
  if (p.invuln > 0 && Math.floor(time * 14) % 2 === 0) {
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#ff5d5d';
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawParticles(ctx, world) {
  ctx.save();
  for (const pt of world.particles) {
    const a = Math.max(0, pt.life / pt.maxLife);
    if (pt.kind === 'ring') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = pt.color;
      ctx.globalAlpha = a;
      ctx.lineWidth = 3.5 * a + 1;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * (1.6 - a * 0.6), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * a + 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}

function drawTexts(ctx, world) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const t of world.texts) {
    const a = Math.max(0, t.life / t.maxLife);
    ctx.globalAlpha = a;
    ctx.font = `700 ${t.size}px Georgia, serif`;
    ctx.fillStyle = t.color;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 6;
    ctx.fillText(t.str, t.x, t.y);
  }
  ctx.restore();
}

// --- HUD -------------------------------------------------------------------
function drawFlameBar(ctx, x, y, w, flame) {
  ctx.save();
  ctx.fillStyle = 'rgba(5, 8, 20, 0.72)';
  roundRect(ctx, x - 8, y - 8, w + 16, 34, 10);
  ctx.fill();
  // Flame icon.
  ctx.fillStyle = '#ffb84d';
  ctx.beginPath();
  ctx.moveTo(x + 8, y + 14);
  ctx.quadraticCurveTo(x + 2, y + 4, x + 8, y - 4);
  ctx.quadraticCurveTo(x + 10, y + 2, x + 14, y - 2);
  ctx.quadraticCurveTo(x + 18, y + 6, x + 14, y + 14);
  ctx.closePath();
  ctx.fill();
  const bx = x + 24;
  const bw = w - 24;
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  roundRect(ctx, bx, y, bw, 14, 7);
  ctx.fill();
  const frac = Math.max(0, flame / 100);
  const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  grad.addColorStop(0, '#ff7a2e');
  grad.addColorStop(0.6, '#ffb84d');
  grad.addColorStop(1, '#ffe9a8');
  ctx.fillStyle = grad;
  if (frac > 0.01) {
    roundRect(ctx, bx, y, Math.max(8, bw * frac), 14, 7);
    ctx.fill();
  }
  ctx.fillStyle = '#ffe9bd';
  ctx.font = '700 13px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.ceil(flame)}`, bx + bw + 10, y + 7);
  ctx.restore();
}

function drawHud(ctx, world, ui) {
  const w = world;
  drawFlameBar(ctx, 20, 22, 240, w.player.flame);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(5, 8, 20, 0.72)';
  roundRect(ctx, LOGICAL_W / 2 - 150, 14, 300, 42, 10);
  ctx.fill();
  ctx.fillStyle = '#ffe9bd';
  ctx.font = '700 22px Georgia, serif';
  ctx.fillText(`Wave ${Math.max(1, w.wave)} / 10`, LOGICAL_W / 2, 28);
  ctx.fillStyle = '#c9cede';
  ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(`SCORE  ${w.score}`, LOGICAL_W / 2, 46);
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(5, 8, 20, 0.72)';
  roundRect(ctx, LOGICAL_W - 300, 14, 280, 42, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd97a';
  ctx.font = '700 16px Georgia, serif';
  ctx.fillText(`◆ ${w.embersCollected}`, LOGICAL_W - 160, 35);
  if (w.combo >= 4) {
    ctx.fillStyle = '#ffb84d';
    ctx.font = '700 18px Georgia, serif';
    ctx.fillText(`Combo x${Math.min(5, 1 + Math.floor(w.combo / 4))}`, LOGICAL_W - 36, 35);
  } else {
    ctx.fillStyle = '#8d94b8';
    ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(`Best ${ui.best}`, LOGICAL_W - 36, 35);
  }
  ctx.restore();

  if (w.bannerTimer > 0 && w.banner) {
    const a = Math.min(1, w.bannerTimer);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = '700 40px Georgia, serif';
    ctx.fillStyle = '#ffe9bd';
    ctx.shadowColor = 'rgba(255, 170, 60, 0.7)';
    ctx.shadowBlur = 24;
    ctx.fillText(w.banner, LOGICAL_W / 2, 150);
    ctx.restore();
  }

  if (ui.muted) {
    ctx.save();
    ctx.fillStyle = 'rgba(5, 8, 20, 0.72)';
    roundRect(ctx, LOGICAL_W - 44, LOGICAL_H - 44, 30, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#8d94b8';
    ctx.font = '600 15px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('M', LOGICAL_W - 29, LOGICAL_H - 28);
    ctx.restore();
  }
}

// --- screens ---------------------------------------------------------------
function drawTitle(ctx, world, ui, time) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 6, 16, 0.45)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const glow = 0.75 + 0.25 * Math.sin(time * 1.6);
  ctx.shadowColor = `rgba(255, 170, 60, ${0.75 * glow})`;
  ctx.shadowBlur = 42;
  ctx.fillStyle = '#ffdf9e';
  ctx.font = '700 96px Georgia, serif';
  ctx.fillText('EMBERKEEP', LOGICAL_W / 2, 168);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffd97a';
  ctx.font = 'italic 600 26px Georgia, serif';
  ctx.fillText('Keeper of the Last Lantern', LOGICAL_W / 2, 232);

  ctx.fillStyle = '#dfe4f5';
  ctx.font = '19px Georgia, serif';
  ctx.fillText('Night is eating the grove. Your lantern is the last light.', LOGICAL_W / 2, 300);
  ctx.fillText('Flare the shades apart. Gather their embers. Hold the light for ten waves.', LOGICAL_W / 2, 332);

  ctx.fillStyle = '#9aa1c2';
  ctx.font = '16px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('Move — WASD / arrows      Aim — mouse      Flare — click / Space', LOGICAL_W / 2, 392);
  ctx.fillText('Pause — P      Mute — M      Restart — R', LOGICAL_W / 2, 420);

  if (ui.best > 0) {
    ctx.fillStyle = '#ffd97a';
    ctx.font = '700 18px Georgia, serif';
    ctx.fillText(`Best score  ${ui.best}`, LOGICAL_W / 2, 470);
  }

  for (const b of buttonsFor('title')) drawButton(ctx, b, ui.hover === b.id);

  if (ui.showHow) {
    drawPanel(ctx, 340, 150, 600, 380);
    ctx.fillStyle = '#ffe9bd';
    ctx.font = '700 28px Georgia, serif';
    ctx.fillText('How to Play', LOGICAL_W / 2, 196);
    ctx.fillStyle = '#dfe4f5';
    ctx.font = '17px Georgia, serif';
    const lines = [
      'The dark sends shades at your lantern. A shade that',
      'touches you burns your flame away.',
      '',
      'Flare (click / Space) bursts the shades around your',
      'lantern. Fallen shades drop embers — gather them to',
      'feed the flame and raise your score.',
      '',
      'Chain defeats to build a combo. Your flame also',
      'drains slowly on its own: the night is patient.',
      '',
      'Survive all ten waves and dawn breaks. Good luck, keeper.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, LOGICAL_W / 2, 240 + i * 26));
    ctx.fillStyle = '#9aa1c2';
    ctx.font = '15px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('Click anywhere to close', LOGICAL_W / 2, 500);
  }
  ctx.restore();
}

function drawStatsPanel(ctx, world, ui, title, titleColor, lines) {
  drawPanel(ctx, 380, 130, 520, 400);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = titleColor;
  ctx.font = '700 52px Georgia, serif';
  ctx.shadowColor = titleColor;
  ctx.shadowBlur = 22;
  ctx.fillText(title, LOGICAL_W / 2, 188);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#dfe4f5';
  ctx.font = '20px Georgia, serif';
  lines.forEach((line, i) => ctx.fillText(line, LOGICAL_W / 2, 258 + i * 36));
  if (ui.best > 0) {
    ctx.fillStyle = '#ffd97a';
    ctx.font = '700 20px Georgia, serif';
    ctx.fillText(`Best score  ${ui.best}`, LOGICAL_W / 2, 258 + lines.length * 36 + 8);
  }
  for (const b of buttonsFor(ui.state)) drawButton(ctx, b, ui.hover === b.id);
  ctx.restore();
}

function drawPaused(ctx, ui) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 6, 16, 0.6)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffe9bd';
  ctx.font = '700 54px Georgia, serif';
  ctx.fillText('Paused', LOGICAL_W / 2, 300);
  ctx.fillStyle = '#9aa1c2';
  ctx.font = '17px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('P to resume · R to restart', LOGICAL_W / 2, 352);
  for (const b of buttonsFor('paused')) drawButton(ctx, b, ui.hover === b.id);
  ctx.restore();
}

// --- frame -----------------------------------------------------------------
export function render(ctx, world, ui, time) {
  ctx.save();
  if (world.shake > 0.2) {
    const s = world.shake;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  drawBackground(ctx, time);
  drawEmbers(ctx, world, time);
  drawShades(ctx, world, time);
  drawPlayer(ctx, world, time);
  drawDarkness(ctx, world);
  drawParticles(ctx, world);
  drawTexts(ctx, world);

  // Hurt flash: a red vignette that bites when a shade lands.
  if (world.flash > 0) {
    const g = ctx.createRadialGradient(
      LOGICAL_W / 2, LOGICAL_H / 2, LOGICAL_H * 0.3,
      LOGICAL_W / 2, LOGICAL_H / 2, LOGICAL_H * 0.75,
    );
    g.addColorStop(0, 'rgba(255, 40, 40, 0)');
    g.addColorStop(1, `rgba(255, 40, 40, ${0.45 * world.flash})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  }

  // Soft vignette so the frame reads as one picture.
  const v = ctx.createRadialGradient(
    LOGICAL_W / 2, LOGICAL_H / 2, LOGICAL_H * 0.42,
    LOGICAL_W / 2, LOGICAL_H / 2, LOGICAL_H * 0.85,
  );
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  if (ui.state === 'playing' || ui.state === 'paused') drawHud(ctx, world, ui);
  if (ui.state === 'title') drawTitle(ctx, world, ui, time);
  if (ui.state === 'paused') drawPaused(ctx, ui);
  if (ui.state === 'victory') {
    drawStatsPanel(ctx, world, ui, 'Dawn Breaks', '#ffe9a8', [
      `You kept the light through all ten waves.`,
      `Score  ${world.score}      Embers  ${world.embersCollected}`,
      `Shades banished  ${world.shadesDefeated}      Best combo  x${Math.min(5, 1 + Math.floor(world.bestCombo / 4))}`,
      `Time  ${Math.floor(world.time / 60)}:${String(Math.floor(world.time % 60)).padStart(2, '0')}`,
    ]);
  }
  if (ui.state === 'gameover') {
    drawStatsPanel(ctx, world, ui, 'The Light Fades', '#c9b8ff', [
      `The grove went dark on wave ${Math.max(1, world.wave)}.`,
      `Score  ${world.score}      Embers  ${world.embersCollected}`,
      `Shades banished  ${world.shadesDefeated}      Waves held  ${Math.max(0, world.wave - 1)}`,
      `Time  ${Math.floor(world.time / 60)}:${String(Math.floor(world.time % 60)).padStart(2, '0')}`,
    ]);
  }
  ctx.restore();
}
