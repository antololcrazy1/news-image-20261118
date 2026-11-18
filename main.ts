// News Image — 18 November 2026. A program that draws one 1024x1024 PNG summing up
// Wednesday 18 November 2026's world news as a newspaper front page: a lead story on the
// US-Iran escalation in the Gulf, Ukraine's second-night strike on the Kerch Bridge, the
// Xi-Trump-Putin meeting at APEC in Shenzhen, COP31 in Antalya, the Gaza winter crisis,
// the Ebola outbreak in DR Congo, plus an "Also today" strip. Everything is drawn with
// code: a tiny embedded 5x7 bitmap font, simple vector shapes, and a hand-rolled PNG
// encoder (node:zlib only). No network, no clock, no randomness: two runs write the
// same bytes. Node 22, standard library only.
//
// Run: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
type RGB = [number, number, number];
const INK: RGB = [242, 240, 233]; // paper white
const MUTED: RGB = [159, 179, 200]; // grey-blue
const BG: RGB = [13, 24, 40]; // deep navy
const PANEL: RGB = [24, 42, 66]; // panel navy
const PANEL2: RGB = [30, 52, 79]; // lighter panel navy
const RED: RGB = [214, 69, 69]; // news red
const DARKRED: RGB = [160, 40, 40];
const GOLD: RGB = [232, 184, 75];
const TEAL: RGB = [63, 167, 160];
const BLUE: RGB = [74, 144, 217];
const ORANGE: RGB = [230, 126, 34];
const GREEN: RGB = [88, 180, 110];
const SEA: RGB = [38, 84, 124];
const SAND: RGB = [210, 180, 140];

// ---------------------------------------------------------------- canvas
const px = new Uint8Array(W * H * 3);
function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
}
function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, x), y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w), y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    let i = (yy * W + x0) * 3;
    for (let xx = x0; xx < x1; xx++) { px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; i += 3; }
  }
}
function hline(x0: number, x1: number, y: number, c: RGB): void {
  if (y < 0 || y >= H) return;
  const a = Math.max(0, Math.min(x0, x1)), b = Math.min(W - 1, Math.max(x0, x1));
  for (let x = a; x <= b; x++) setPixel(x, y, c);
}
function vline(x: number, y0: number, y1: number, c: RGB): void {
  if (x < 0 || x >= W) return;
  const a = Math.max(0, Math.min(y0, y1)), b = Math.min(H - 1, Math.max(y0, y1));
  for (let y = a; y <= b; y++) setPixel(x, y, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  for (;;) {
    setPixel(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}
function thickLine(x0: number, y0: number, x1: number, y1: number, t: number, c: RGB): void {
  const r = Math.floor(t / 2);
  for (let ox = -r; ox <= r; ox++) for (let oy = -r; oy <= r; oy++) line(x0 + ox, y0 + oy, x1 + ox, y1 + oy, c);
}
function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -w; x <= w; x++) setPixel(cx + x, cy + y, c);
  }
}
function circle(cx: number, cy: number, r: number, c: RGB): void {
  for (let a = 0; a < 360; a += 2) {
    const rad = (a * Math.PI) / 180;
    setPixel(Math.round(cx + r * Math.cos(rad)), Math.round(cy + r * Math.sin(rad)), c);
  }
}
// Scanline polygon fill (deterministic, integer math).
function fillPoly(pts: Array<[number, number]>, c: RGB): void {
  let minY = H, maxY = 0;
  for (const [, y] of pts) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
  for (let y = Math.max(0, minY); y <= Math.min(H - 1, maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % pts.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(Math.round(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0)));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) hline(xs[k], xs[k + 1], y, c);
  }
}
function fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  fillPoly([[x0, y0], [x1, y1], [x2, y2]], c);
}
function star(cx: number, cy: number, r: number, c: RGB): void {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const rad = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : Math.round(r * 0.45);
    pts.push([Math.round(cx + rr * Math.cos(rad)), Math.round(cy + rr * Math.sin(rad))]);
  }
  fillPoly(pts, c);
}
function panel(x: number, y: number, w: number, h: number, c: RGB): void {
  fillRect(x, y, w, h, c);
  // 2px border, slightly lighter
  fillRect(x, y, w, 2, [52, 78, 110]);
  fillRect(x, y + h - 2, w, 2, [52, 78, 110]);
  fillRect(x, y, 2, h, [52, 78, 110]);
  fillRect(x + w - 2, y, 2, h, [52, 78, 110]);
}
function kicker(x: number, y: number, text: string, c: RGB): void {
  // red tag with white text
  const w = text.length * 12 + 14;
  fillRect(x, y, w, 20, c);
  drawText(x + 7, y + 4, text, 1, INK);
}

// ---------------------------------------------------------------- 5x7 font
// Each glyph: 7 rows of 5 cells, '#' = on. Uppercase, digits, punctuation.
const FONT: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#..##', '#.#.#', '##..#', '#...#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '...#.', '..#..', '..#..', '..#..'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '.##..', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.#...'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  '"': ['.#.#.', '.#.#.', '.#.#.', '.....', '.....', '.....', '.....'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
  '(': ['...#.', '..#..', '..#..', '..#..', '..#..', '..#..', '...#.'],
  ')': ['.#...', '..#..', '..#..', '..#..', '..#..', '..#..', '.#...'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '#.##.', '#..##'],
  '&': ['.##..', '#..#.', '#..#.', '.#...', '#.#.#', '#..#.', '.##.#'],
  '+': ['.....', '..#..', '..#..', '.###.', '..#..', '..#..', '.....'],
  '=': ['.....', '.....', '.###.', '.....', '.###.', '.....', '.....'],
  '*': ['.....', '#...#', '.#.#.', '.###.', '.#.#.', '#...#', '.....'],
  $: ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  _: ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
};
function glyph(ch: string): string[] {
  const up = ch.toUpperCase();
  return FONT[up] ?? FONT['?'];
}
function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}
function drawText(x: number, y: number, text: string, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of text) {
    const g = glyph(ch);
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === '#') fillRect(cx + col * scale, y + r * scale, scale, scale, c);
      }
    }
    cx += 6 * scale;
  }
}
function drawTextCentered(x: number, y: number, w: number, text: string, scale: number, c: RGB): void {
  drawText(x + Math.floor((w - textWidth(text, scale)) / 2), y, text, scale, c);
}
// Word-wrap a string to lines of at most maxChars characters.
function wrap(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur === '' ? w : cur + ' ' + w;
    if (next.length <= maxChars) { cur = next; continue; }
    if (cur !== '') lines.push(cur);
    cur = w;
  }
  if (cur !== '') lines.push(cur);
  return lines;
}
function drawPara(x: number, y: number, maxW: number, text: string, scale: number, c: RGB, lineGap?: number): number {
  const maxChars = Math.max(4, Math.floor((maxW + scale) / (6 * scale)));
  const lines = wrap(text, maxChars);
  const lh = 7 * scale + (lineGap ?? 3 * scale);
  lines.forEach((ln, i) => drawText(x, y + i * lh, ln, scale, c));
  return y + lines.length * lh;
}

// ---------------------------------------------------------------- icons
// Tanker on a burning sea (lead story, right side of the lead panel).
function drawTanker(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [16, 34, 56]); // night sky over the Gulf
  fillCircle(x + w - 52, y + 34, 22, GOLD); // low sun
  fillCircle(x + w - 52, y + 34, 15, [240, 200, 100]);
  // distant smoke columns
  fillRect(x + 30, y + 30, 10, 70, [90, 90, 95]);
  fillRect(x + 52, y + 44, 8, 56, [80, 80, 85]);
  fillRect(x + 200, y + 22, 12, 78, [90, 90, 95]);
  // sea
  fillRect(x, y + h - 52, w, 52, SEA);
  for (let i = 0; i < 5; i++) {
    const wy = y + h - 44 + i * 9;
    for (let xx = x + 6 + (i % 2) * 14; xx < x + w - 10; xx += 34) hline(xx, xx + 18, wy, [120, 170, 210]);
  }
  // hull
  const hy = y + h - 78;
  fillPoly([[x + 18, hy], [x + w - 30, hy], [x + w - 58, hy + 26], [x + 34, hy + 26]], DARKRED);
  fillRect(x + 18, hy, w - 48, 6, [120, 30, 30]);
  // containers
  fillRect(x + 44, hy - 26, 34, 26, ORANGE);
  fillRect(x + 84, hy - 26, 34, 26, TEAL);
  fillRect(x + 124, hy - 26, 34, 26, GOLD);
  fillRect(x + 164, hy - 18, 30, 18, GREEN);
  // bridge tower + funnel with smoke
  fillRect(x + w - 66, hy - 40, 26, 40, INK);
  fillRect(x + w - 62, hy - 52, 18, 12, [60, 60, 65]);
  // explosion burst above the deck
  const ex = x + 108, ey = hy - 52;
  star(ex, ey, 26, ORANGE);
  star(ex, ey, 15, GOLD);
  star(ex, ey, 7, INK);
  line(ex - 34, ey - 30, ex - 14, ey - 12, ORANGE);
  line(ex + 34, ey - 30, ex + 14, ey - 12, ORANGE);
  line(ex - 40, ey + 6, ex - 16, ey, ORANGE);
  line(ex + 40, ey + 6, ex + 16, ey, ORANGE);
  drawText(x + 10, y + 8, 'GULF OF OMAN', 1, MUTED);
  drawText(x + 10, y + 18, 'STRAIT OF HORMUZ', 1, MUTED);
}

// Kerch Bridge, broken span falling into the strait.
function drawBridge(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [18, 32, 54]);
  // sky glow
  fillCircle(x + w - 40, y + 26, 16, [220, 120, 60]);
  // water
  fillRect(x, y + h - 18, w, 18, SEA);
  for (let i = 0; i < 2; i++) {
    const wy = y + h - 13 + i * 6;
    for (let xx = x + 4 + (i % 2) * 12; xx < x + w - 8; xx += 30) hline(xx, xx + 16, wy, [120, 170, 210]);
  }
  const deckY = y + h - 40;
  const gapL = x + Math.floor(w * 0.44), gapR = x + Math.floor(w * 0.62);
  // deck, left and right of the gap
  fillRect(x + 8, deckY, gapL - x - 8, 8, INK);
  fillRect(gapR, deckY, x + w - 8 - gapR, 8, INK);
  // fallen span, tilted into the water
  fillPoly([[gapL + 4, deckY + 4], [gapR - 4, deckY + 4], [gapR - 14, deckY + 26], [gapL + 14, deckY + 26]], [200, 200, 195]);
  // towers
  fillRect(x + 34, deckY - 36, 10, 36, INK);
  fillRect(x + w - 44, deckY - 36, 10, 36, INK);
  // cables
  line(x + 39, deckY - 36, x + 8, deckY, [150, 160, 175]);
  line(x + 39, deckY - 36, gapL, deckY, [150, 160, 175]);
  line(x + w - 39, deckY - 36, gapR, deckY, [150, 160, 175]);
  line(x + w - 39, deckY - 36, x + w - 8, deckY, [150, 160, 175]);
  // blast flash at the gap
  star((gapL + gapR) / 2, deckY - 16, 18, ORANGE);
  star((gapL + gapR) / 2, deckY - 16, 9, GOLD);
  drawText(x + 10, y + 8, 'KERCH STRAIT', 1, MUTED);
}

// Three flags over a Shenzhen skyline (APEC summit).
function drawSummit(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [16, 34, 56]);
  // skyline
  const base = y + h - 22;
  const towers: Array<[number, number, number]> = [[14, 38, 34], [52, 52, 44], [104, 32, 30], [142, 58, 48], [196, 42, 36], [238, 50, 42], [286, 36, 32]];
  for (const [tx, th, tw] of towers) {
    fillRect(x + tx, base - th, tw, th, [52, 78, 110]);
    for (let wy = base - th + 6; wy < base - 6; wy += 11) {
      for (let wx = x + tx + 5; wx < x + tx + tw - 5; wx += 11) fillRect(wx, wy, 3, 4, GOLD);
    }
  }
  fillRect(x, base, w, 22, [22, 40, 62]);
  // three flag poles with CN / US / RU colours
  const poleY = y + 4, poleH = 40;
  const flags: Array<{ dx: number; c: RGB; label: string }> = [
    { dx: 60, c: [222, 41, 16], label: 'CN' },
    { dx: 160, c: [60, 90, 180], label: 'US' },
    { dx: 260, c: [200, 200, 205], label: 'RU' },
  ];
  for (const f of flags) {
    const fx = x + f.dx;
    vline(fx, poleY, poleY + poleH, INK);
    fillRect(fx, poleY, 52, 30, f.c);
    if (f.label === 'US') {
      for (let s = 0; s < 4; s++) fillRect(fx, poleY + 4 + s * 7, 52, 3, INK);
      fillRect(fx, poleY, 22, 14, [40, 60, 140]);
    }
    if (f.label === 'RU') {
      fillRect(fx, poleY + 10, 52, 10, [40, 80, 200]);
      fillRect(fx, poleY + 20, 52, 10, [200, 40, 40]);
    }
    if (f.label === 'CN') star(fx + 12, poleY + 12, 7, GOLD);
    drawText(fx + 18, poleY + 36, f.label, 1, INK);
  }
  drawText(x + 10, y + 8, 'SHENZHEN', 1, MUTED);
}

// Globe with a rising thermometer (COP31).
function drawGlobe(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [16, 34, 56]);
  const cx = x + 66, cy = y + 40, r = 30;
  fillCircle(cx, cy, r, BLUE);
  fillCircle(cx - 9, cy - 7, 9, GREEN);
  fillCircle(cx + 10, cy + 8, 10, GREEN);
  fillCircle(cx + 12, cy - 12, 6, GREEN);
  circle(cx, cy, r, INK);
  // meridians
  for (let k = -2; k <= 2; k++) {
    for (let a = 0; a < 180; a += 4) {
      const rad = (a * Math.PI) / 180;
      const xx = Math.round(cx + r * Math.sin(rad) * (k / 2.4));
      const yy = Math.round(cy - r * Math.cos(rad));
      setPixel(xx, yy, [140, 190, 240]);
    }
  }
  // thermometer
  const tx = x + w - 56, ty = y + 8;
  fillRect(tx, ty, 16, 48, INK);
  fillRect(tx + 3, ty + 3, 10, 42, [240, 240, 235]);
  fillRect(tx + 3, ty + 24, 10, 21, RED);
  fillCircle(tx + 8, ty + 50, 11, RED);
  fillCircle(tx + 8, ty + 50, 6, DARKRED);
  drawText(x + w - 104, ty + 52, '1.5C', 1, RED);
  drawText(x + 10, y + 8, 'ANTALYA', 1, MUTED);
}

// Tent in the snow, aid box (Gaza winter).
function drawTent(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [24, 36, 58]);
  fillRect(x, y + h - 14, w, 14, [200, 210, 220]); // snow ground
  // tent
  fillTriangle(x + 30, y + h - 14, x + 110, y + 12, x + 190, y + h - 14, [196, 164, 110]);
  fillTriangle(x + 99, y + h - 14, x + 110, y + 36, x + 121, y + h - 14, [60, 50, 44]);
  line(x + 30, y + h - 14, x + 110, y + 12, [140, 110, 70]);
  line(x + 190, y + h - 14, x + 110, y + 12, [140, 110, 70]);
  // snowflakes
  const flakes: Array<[number, number]> = [[36, 22], [180, 16], [210, 40], [60, 44], [150, 56], [20, 56], [230, 60]];
  for (const [fx0, fy0] of flakes) {
    const fx = x + fx0, fy = y + fy0;
    line(fx - 4, fy, fx + 4, fy, INK);
    line(fx, fy - 4, fx, fy + 4, INK);
    line(fx - 3, fy - 3, fx + 3, fy + 3, INK);
    line(fx - 3, fy + 3, fx + 3, fy - 3, INK);
  }
  // aid box
  fillRect(x + w - 66, y + h - 40, 44, 26, INK);
  fillRect(x + w - 66, y + h - 40, 44, 4, RED);
  drawText(x + w - 58, y + h - 30, 'AID', 1, RED);
  drawText(x + 10, y + 8, 'GAZA', 1, MUTED);
}

// Virus cell (Ebola).
function drawVirus(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [16, 34, 56]);
  const cx = x + Math.floor(w / 2), cy = y + 40, r = 26;
  for (let a = 0; a < 360; a += 30) {
    const rad = (a * Math.PI) / 180;
    const x0 = Math.round(cx + (r - 3) * Math.cos(rad)), y0 = Math.round(cy + (r - 3) * Math.sin(rad));
    const x1 = Math.round(cx + (r + 9) * Math.cos(rad)), y1 = Math.round(cy + (r + 9) * Math.sin(rad));
    thickLine(x0, y0, x1, y1, 3, RED);
    fillCircle(x1, y1, 3, RED);
  }
  fillCircle(cx, cy, r, [150, 60, 90]);
  fillCircle(cx - 9, cy - 6, 6, [190, 90, 120]);
  fillCircle(cx + 10, cy + 7, 7, [190, 90, 120]);
  fillCircle(cx + 8, cy - 11, 4, [190, 90, 120]);
  drawText(x + 10, y + 8, 'DR CONGO', 1, MUTED);
}

// Cyclone spiral.
function drawCyclone(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [16, 34, 56]);
  const cx = x + Math.floor(w / 2), cy = y + 40;
  for (let r = 32; r >= 8; r -= 6) {
    const a0 = r * 0.35;
    for (let a = 0; a < 300; a += 3) {
      const rad = ((a + a0 * 57) * Math.PI) / 180;
      setPixel(Math.round(cx + r * Math.cos(rad)), Math.round(cy + r * Math.sin(rad) * 0.8), [140, 190, 240]);
      setPixel(Math.round(cx + r * Math.cos(rad)) + 1, Math.round(cy + r * Math.sin(rad) * 0.8), [140, 190, 240]);
    }
  }
  fillCircle(cx, cy, 5, INK);
  drawText(x + 10, y + 8, 'COOK ISLANDS', 1, MUTED);
}

// ---------------------------------------------------------------- layout
function drawMasthead(): void {
  fillRect(0, 0, W, 8, RED);
  drawText(24, 26, 'WORLD NEWS', 6, INK);
  drawText(24, 78, "ONE DAY. ONE IMAGE. THE WORLD'S TOP STORIES.", 2, MUTED);
  const d1 = 'WEDNESDAY';
  const d2 = '18 NOVEMBER 2026';
  drawText(1000 - textWidth(d1, 3), 24, d1, 3, GOLD);
  drawText(1000 - textWidth(d2, 3), 54, d2, 3, INK);
  fillRect(12, 106, 1000, 2, [52, 78, 110]);
}

function drawLead(): void {
  const x = 12, y = 116, w = 1000, h = 284;
  panel(x, y, w, h, PANEL);
  kicker(x + 16, y + 14, 'LEAD STORY - GULF CRISIS', RED);
  drawText(x + 16, y + 46, 'US SINKS FIVE', 4, INK);
  drawText(x + 16, y + 82, 'IRANIAN TANKERS', 4, INK);
  drawPara(x + 16, y + 136, 600, 'US JETS HIT A MISSILE SITE ON QESHM ISLAND AFTER IRAN HIT A US RADAR SITE.', 2, INK, 4);
  drawPara(x + 16, y + 180, 600, 'IRAN FIRED DRONES AT BAHRAIN AND KUWAIT; TEHRAN SAYS IT HIT 10 SHIPS NEAR HORMUZ.', 2, MUTED, 4);
  fillRect(x + 16, y + 226, 600, 2, [52, 78, 110]);
  drawPara(x + 16, y + 238, 600, 'OIL SLIPS ON US STOCK BUILD; HORMUZ RISKS LIMIT LOSSES.', 2, GOLD, 4);
  drawTanker(x + 636, y + 12, 352, 260);
}

function drawMidRow(): void {
  // Kerch Bridge
  const ax = 12, ay = 412, aw = 492, ah = 228;
  panel(ax, ay, aw, ah, PANEL);
  drawBridge(ax + 8, ay + 8, aw - 16, 92);
  kicker(ax + 16, ay + 108, 'UKRAINE - CRIMEA', RED);
  drawText(ax + 16, ay + 134, 'KERCH BRIDGE HIT FOR SECOND NIGHT', 2, INK);
  drawPara(ax + 16, ay + 162, aw - 32, 'SECOND NIGHT IN A ROW. PART OF THE ROAD SPAN FELL INTO THE STRAIT AS RUSSIA HIT BRIDGES AHEAD OF THE SUMMIT.', 2, MUTED);
  // APEC summit
  const bx = 520, by = 412, bw = 492, bh = 228;
  panel(bx, by, bw, bh, PANEL);
  drawSummit(bx + 8, by + 8, bw - 16, 92);
  kicker(bx + 16, by + 108, 'APEC - SHENZHEN', TEAL);
  drawText(bx + 16, by + 134, 'XI, TRUMP AND PUTIN MEET IN SHENZHEN', 2, INK);
  drawPara(bx + 16, by + 162, bw - 32, 'THREE LEADERS MEET THURSDAY AT THE APEC SUMMIT. XI CALLS FOR FREE AND OPEN TRADE.', 2, MUTED);
}

function drawBottomRow(): void {
  const y = 652, h = 216;
  // COP31
  let x = 12, w = 325;
  panel(x, y, w, h, PANEL);
  drawGlobe(x + 8, y + 8, w - 16, 76);
  kicker(x + 12, y + 92, 'CLIMATE - COP31', TEAL);
  drawText(x + 12, y + 118, 'COP31: 144 ITEMS', 2, INK);
  drawText(x + 12, y + 140, 'STILL IN DISPUTE', 2, INK);
  drawPara(x + 12, y + 166, w - 24, 'ANTALYA TALKS ENTER FINAL DAYS. DEAL DUE FRIDAY.', 2, MUTED);
  // Gaza winter
  x = 349; w = 325;
  panel(x, y, w, h, PANEL);
  drawTent(x + 8, y + 8, w - 16, 76);
  kicker(x + 12, y + 92, 'GAZA - WINTER', RED);
  drawText(x + 12, y + 118, 'UN WARNS OF MORE', 2, INK);
  drawText(x + 12, y + 140, 'COLD DEATHS IN GAZA', 2, INK);
  drawPara(x + 12, y + 166, w - 24, '1.7M DISPLACED FACE WINTER WITH NO SHELTER.', 2, MUTED);
  // Ebola
  x = 686; w = 326;
  panel(x, y, w, h, PANEL);
  drawVirus(x + 8, y + 8, w - 16, 76);
  kicker(x + 12, y + 92, 'HEALTH - CONGO', RED);
  drawText(x + 12, y + 118, 'EBOLA IN CONGO MORE', 2, INK);
  drawText(x + 12, y + 140, 'THAN DOUBLES', 2, INK);
  drawPara(x + 12, y + 166, w - 24, '5,400 DEAD. WORLD COURT TO RULE ON MYANMAR CASE.', 2, MUTED);
}

function drawAlsoToday(): void {
  const x = 12, y = 880, w = 1000, h = 144;
  panel(x, y, w, h, PANEL2);
  kicker(x + 16, y + 12, 'ALSO TODAY', GOLD);
  const left: string[] = [
    'CYCLONE XAVIER HITS COOK ISLANDS',
    'PELTOLA WINS ALASKA SENATE SEAT',
    "PATTINSON NAMED THE NEW JAMES BOND",
  ];
  const right: string[] = [
    'VOYAGER 1 NEARS ONE LIGHT-DAY OUT',
    "EISENKOT TO FORM ISRAEL'S NEXT GOVT",
    'RUSSIAN PLANE CRASH IN SIBERIA: 19 DEAD',
  ];
  for (let i = 0; i < 3; i++) {
    const yy = y + 44 + i * 28;
    fillRect(x + 16, yy + 3, 8, 8, RED);
    drawText(x + 32, yy, left[i], 2, INK);
    fillRect(x + 516, yy + 3, 8, 8, RED);
    drawText(x + 532, yy, right[i], 2, INK);
  }
  const credit = 'WEDNESDAY 18 NOVEMBER 2026 - FROM REUTERS, AP, AFP, AL JAZEERA, THE GUARDIAN';
  drawTextCentered(x, y + h - 16, w, credit, 1, MUTED);
}

// ---------------------------------------------------------------- PNG out
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 4, 'ascii');
  data.copy(out, 8);
  const crc = crc32(Buffer.concat([Buffer.from(type, 'ascii'), data]));
  out.writeUInt32BE(crc, 8 + data.length);
  return out;
}
function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- main
function main(): void {
  fillRect(0, 0, W, H, BG);
  // faint dot grid on the background
  for (let gy = 120; gy < H; gy += 24) {
    for (let gx = 12; gx < W; gx += 24) setPixel(gx, gy, [20, 34, 54]);
  }
  drawMasthead();
  drawLead();
  drawMidRow();
  drawBottomRow();
  drawAlsoToday();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'entry.png'), encodePNG());
}

main();
