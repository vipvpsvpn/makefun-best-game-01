// Keyboard and mouse for Emberkeep. The canvas is drawn at a fixed logical
// size (1280x720) and scaled by CSS, so mouse positions are mapped back into
// logical coordinates. Keys and clicks are edge-triggered: `pressed()` and
// `clicked()` answer once per physical press, then clear.

export const LOGICAL_W = 1280;
export const LOGICAL_H = 720;

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressedKeys = new Set();
    this.mouse = { x: LOGICAL_W / 2, y: LOGICAL_H / 2, down: false };
    this.clicked = false;
    this.clickedAt = { x: 0, y: 0 };
    this.anyGesture = false;

    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      this.down.add(event.code);
      this.pressedKeys.add(event.code);
      this.anyGesture = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
    });
    window.addEventListener('keyup', (event) => {
      this.down.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.down.clear();
      this.mouse.down = false;
    });

    const toLogical = (event) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * LOGICAL_W,
        y: ((event.clientY - rect.top) / rect.height) * LOGICAL_H,
      };
    };
    canvas.addEventListener('mousemove', (event) => {
      const p = toLogical(event);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
    });
    canvas.addEventListener('mousedown', (event) => {
      const p = toLogical(event);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.mouse.down = true;
      this.clicked = true;
      this.clickedAt = p;
      this.anyGesture = true;
    });
    window.addEventListener('mouseup', () => {
      this.mouse.down = false;
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  isDown(code) {
    return this.down.has(code);
  }

  // True once after the key went down, until the frame reads it.
  pressed(code) {
    return this.pressedKeys.has(code);
  }

  // True once after a mouse click on the canvas, until the frame reads it.
  click() {
    if (!this.clicked) return null;
    return this.clickedAt;
  }

  // Movement vector from WASD or arrow keys, normalised.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.down.has('KeyA') || this.down.has('ArrowLeft')) x -= 1;
    if (this.down.has('KeyD') || this.down.has('ArrowRight')) x += 1;
    if (this.down.has('KeyW') || this.down.has('ArrowUp')) y -= 1;
    if (this.down.has('KeyS') || this.down.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.hypot(x, y);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  // Call at the end of every frame so edges fire exactly once.
  endFrame() {
    this.pressedKeys.clear();
    this.clicked = false;
  }
}
