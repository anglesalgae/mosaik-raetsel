import { createRng, pick, randInt, randRange, type Rng } from './random';

/**
 * Motiv-Generator: entwirft Schwarz-Weiß-Bilder ohne Vorlage.
 * Alle Funktionen sind deterministisch (gleicher Startwert → gleiches Motiv).
 */
export type MotifKind = 'blobs' | 'sprite' | 'shapes' | 'waves' | 'mandala' | 'maze';

export const MOTIF_KINDS: readonly { kind: MotifKind; label: string }[] = [
  { kind: 'blobs', label: 'Kleckse' },
  { kind: 'sprite', label: 'Pixelfigur' },
  { kind: 'shapes', label: 'Geometrie' },
  { kind: 'waves', label: 'Wellen' },
  { kind: 'mandala', label: 'Mandala' },
  { kind: 'maze', label: 'Labyrinth' }
];

export const motifLabel = (kind: MotifKind): string =>
  MOTIF_KINDS.find(m => m.kind === kind)?.label ?? kind;

export interface Motif {
  kind: MotifKind;
  seed: number;
  pattern: Uint8Array;
}

/** Gefüllter Anteil, der ein gut lösbares und ansehnliches Rätsel ergibt. */
const MIN_FILL = 0.2, MAX_FILL = 0.72;
/** Labyrinthe bestehen überwiegend aus Wänden und dürfen dunkler sein. */
const MAX_FILL_BY_KIND: Partial<Record<MotifKind, number>> = { maze: 0.9 };

type Painter = (w: number, h: number, rnd: Rng) => Uint8Array;

/* ---------- Symmetrie-Helfer ---------- */

type Symmetry = 'none' | 'mirror' | 'quad' | 'rotate';

function applySymmetry(p: Uint8Array, w: number, h: number, sym: Symmetry): void {
  if (sym === 'none') return;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (sym === 'mirror' && x >= w / 2) p[i] = p[y * w + (w - 1 - x)];
      if (sym === 'quad') {
        const sx = x < w / 2 ? x : w - 1 - x, sy = y < h / 2 ? y : h - 1 - y;
        p[i] = p[sy * w + sx];
      }
      if (sym === 'rotate' && (y > (h - 1) / 2 || (y === (h - 1) / 2 && x > (w - 1) / 2))) {
        p[i] = p[(h - 1 - y) * w + (w - 1 - x)];
      }
    }
  }
}

/* ---------- Motive ---------- */

/** Organische Flächen: Zufallsrauschen, mehrfach geglättet (zellulärer Automat). */
const blobs: Painter = (w, h, rnd) => {
  let p = new Uint8Array(w * h);
  const density = randRange(rnd, 0.44, 0.52);
  for (let i = 0; i < p.length; i++) p[i] = rnd() < density ? 1 : 0;
  applySymmetry(p, w, h, pick(rnd, ['none', 'mirror', 'quad', 'rotate'] as const));
  const steps = randInt(rnd, 3, 5);
  for (let s = 0; s < steps; s++) {
    const next = new Uint8Array(p.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h) c += p[yy * w + xx];
      }
      next[y * w + x] = c >= 5 ? 1 : 0;
    }
    p = next;
  }
  return p;
};

/** Spiegelsymmetrische Pixelfigur (wie aus alten Videospielen), passend vergrößert. */
const sprite: Painter = (w, h, rnd) => {
  const scale = Math.max(1, Math.round(Math.min(w, h) / 9));
  const sw = Math.floor(w / scale), sh = Math.floor(h / scale);
  let small = new Uint8Array(sw * sh);
  const cx = (sw - 1) / 2, cy = (sh - 1) / 2;
  for (let y = 1; y < sh - 1; y++) {
    for (let x = 1; x <= Math.ceil(cx); x++) {
      const dist = Math.hypot((x - cx) / (sw / 2), (y - cy) / (sh / 2));
      small[y * sw + x] = rnd() < 0.8 - 0.6 * dist ? 1 : 0;
    }
  }
  applySymmetry(small, sw, sh, 'mirror');
  // Einzelne Pixel ohne direkten Nachbarn entfernen, damit die Figur zusammenhängt
  const cleaned = Uint8Array.from(small);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const i = y * sw + x;
    if (!small[i]) continue;
    const n = (x > 0 ? small[i - 1] : 0) + (x < sw - 1 ? small[i + 1] : 0)
      + (y > 0 ? small[i - sw] : 0) + (y < sh - 1 ? small[i + sw] : 0);
    if (!n) cleaned[i] = 0;
  }
  small = cleaned;
  const p = new Uint8Array(w * h);
  const ox = Math.floor((w - sw * scale) / 2), oy = Math.floor((h - sh * scale) / 2);
  for (let y = 0; y < sh * scale; y++) for (let x = 0; x < sw * scale; x++) {
    p[(y + oy) * w + (x + ox)] = small[Math.floor(y / scale) * sw + Math.floor(x / scale)];
  }
  return p;
};

/** Überlagerte Kreise, Ringe, Rechtecke und Rauten, teils als Gegenform (XOR). */
const shapes: Painter = (w, h, rnd) => {
  const p = new Uint8Array(w * h);
  const m = Math.min(w, h);
  const symmetric = rnd() < 0.5;
  const count = randInt(rnd, 3, 6);
  for (let k = 0; k < count; k++) {
    const type = pick(rnd, ['circle', 'ring', 'rect', 'diamond'] as const);
    const cx = symmetric ? (w - 1) / 2 : randRange(rnd, 0.15, 0.85) * w;
    const cy = randRange(rnd, 0.15, 0.85) * h;
    const r = randRange(rnd, 0.12, 0.38) * m;
    const rw = randRange(rnd, 0.1, 0.4) * w, rh = randRange(rnd, 0.1, 0.4) * h;
    const thick = Math.max(1.2, r * randRange(rnd, 0.25, 0.45));
    const xor = k > 0 && rnd() < 0.4;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - (cx + 0.5), dy = y + 0.5 - (cy + 0.5), d = Math.hypot(dx, dy);
      let inside = false;
      if (type === 'circle') inside = d <= r;
      else if (type === 'ring') inside = d <= r && d >= r - thick;
      else if (type === 'rect') inside = Math.abs(dx) <= rw / 2 && Math.abs(dy) <= rh / 2;
      else inside = Math.abs(dx) / (rw / 2 + 0.5) + Math.abs(dy) / (rh / 2 + 0.5) <= 1;
      if (inside) p[y * w + x] = xor ? p[y * w + x] ^ 1 : 1;
    }
  }
  return p;
};

/** Verzerrte Streifen in zufälliger Richtung. */
const waves: Painter = (w, h, rnd) => {
  const p = new Uint8Array(w * h);
  const angle = randRange(rnd, 0, Math.PI);
  const period = randRange(rnd, 5, 10);
  const wobble = randRange(rnd, 0.6, 2.2), wobblePeriod = randRange(rnd, 8, 20);
  const phase = randRange(rnd, 0, Math.PI * 2), threshold = randRange(rnd, -0.25, 0.25);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x * cos + y * sin, v = -x * sin + y * cos;
    const val = Math.sin((2 * Math.PI * u) / period + phase + wobble * Math.sin((2 * Math.PI * v) / wobblePeriod));
    p[y * w + x] = val > threshold ? 1 : 0;
  }
  return p;
};

/** Radialsymmetrisches Muster aus Blättern und Ringen. */
const mandala: Painter = (w, h, rnd) => {
  const p = new Uint8Array(w * h);
  const folds = pick(rnd, [4, 6, 8, 8, 12] as const);
  const rings = randRange(rnd, 1.5, 3.5);
  const petal = randRange(rnd, 0.6, 1.2), ringWeight = randRange(rnd, 0.5, 1.1);
  const twist = randRange(rnd, -1.5, 1.5), threshold = randRange(rnd, -0.3, 0.3);
  const cx = (w - 1) / 2, cy = (h - 1) / 2, R = Math.min(w, h) / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x - cx) / R, dy = (y - cy) / R, r = Math.hypot(dx, dy);
    if (r > 0.98) continue;
    const t = Math.atan2(dy, dx);
    const val = petal * Math.cos(folds * t + twist * r) * (0.4 + r) + ringWeight * Math.cos(2 * Math.PI * rings * r);
    p[y * w + x] = val > threshold ? 1 : 0;
  }
  return p;
};

/**
 * Labyrinth (Tiefensuche): Wände gefüllt, Gänge leer.
 * Zufällig mit 1 oder 2 Felder dicken Wänden: dünne Wände ergeben meist knifflige,
 * dicke Wände eher leichte Rätsel. Gänge sind immer 1 Feld breit
 * (breitere Gänge führen zu mehrdeutigen Rätseln).
 */
const maze: Painter = (w, h, rnd) => {
  const wall = rnd() < 0.5 ? 1 : 2, corridor = 1, step = corridor + wall;
  const cw = Math.floor((w - wall) / step), ch = Math.floor((h - wall) / step);
  const p = new Uint8Array(w * h);
  if (cw < 2 || ch < 2) return p.fill(1);
  // Übrige Zeilen/Spalten bleiben leer, das Labyrinth wird mittig gesetzt
  const mw = cw * step + wall, mh = ch * step + wall;
  const ox = Math.floor((w - mw) / 2), oy = Math.floor((h - mh) / 2);
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) p[(oy + y) * w + ox + x] = 1;
  const clear = (x0: number, y0: number, cols: number, rows: number) => {
    for (let y = y0; y < y0 + rows; y++) for (let x = x0; x < x0 + cols; x++) p[(oy + y) * w + ox + x] = 0;
  };
  const seen = new Uint8Array(cw * ch);
  const stack: number[] = [0];
  seen[0] = 1;
  clear(wall, wall, corridor, corridor);
  while (stack.length) {
    const c = stack[stack.length - 1], x = c % cw, y = Math.floor(c / cw);
    const nbs = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
      .map(([dx, dy]) => [x + dx, y + dy] as const)
      .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < cw && ny < ch && !seen[ny * cw + nx]);
    if (!nbs.length) { stack.pop(); continue; }
    const [nx, ny] = pick(rnd, nbs);
    seen[ny * cw + nx] = 1;
    clear(wall + nx * step, wall + ny * step, corridor, corridor);
    // Durchbruch in der Wand zwischen den beiden Zellen
    const horizontal = nx !== x;
    clear(
      wall + Math.min(x, nx) * step + (horizontal ? corridor : 0),
      wall + Math.min(y, ny) * step + (horizontal ? 0 : corridor),
      horizontal ? wall : corridor,
      horizontal ? corridor : wall
    );
    stack.push(ny * cw + nx);
  }
  // Ein- und Ausgang
  clear(0, wall, wall, corridor);
  clear(mw - wall, wall + (ch - 1) * step, wall, corridor);
  return p;
};

const PAINTERS: Record<MotifKind, Painter> = { blobs, sprite, shapes, waves, mandala, maze };

const fillOf = (p: Uint8Array) => p.reduce((s, v) => s + v, 0) / p.length;

/**
 * Erzeugt ein Motiv. Bei „any“ wird die Art zufällig gewählt.
 * Motive mit zu wenig oder zu viel Fläche werden mit abgeleitetem Startwert neu erzeugt.
 */
export function generateMotif(kind: MotifKind | 'any', width: number, height: number, seed: number): Motif {
  const chooser = createRng(seed ^ 0x9e3779b9);
  let best: Motif | null = null, bestDist = Infinity;
  for (let attempt = 0; attempt < 12; attempt++) {
    const k = kind === 'any' ? pick(chooser, MOTIF_KINDS).kind : kind;
    const s = (seed + attempt * 7919) >>> 0;
    const pattern = PAINTERS[k](width, height, createRng(s));
    const fill = fillOf(pattern);
    const maxFill = MAX_FILL_BY_KIND[k] ?? MAX_FILL;
    if (fill >= MIN_FILL && fill <= maxFill) return { kind: k, seed: s, pattern };
    const dist = fill < MIN_FILL ? MIN_FILL - fill : fill - maxFill;
    if (dist < bestDist) { bestDist = dist; best = { kind: k, seed: s, pattern }; }
  }
  return best!;
}
