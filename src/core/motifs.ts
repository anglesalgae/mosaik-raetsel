import { GLYPH_H, GLYPH_W, glyphPixel, lineWidth, normalizeText } from './pixelFont';
import { createRng, pick, randInt, randRange, type Rng } from './random';
import { SILHOUETTES } from './silhouettes';

/**
 * Motiv-Generator: entwirft Schwarz-Weiß-Bilder ohne Vorlage.
 * Alle Funktionen sind deterministisch (gleicher Startwert → gleiches Motiv).
 */
export type MotifKind = 'blobs' | 'sprite' | 'shapes' | 'waves' | 'mandala' | 'maze'
  | 'landscape' | 'caves' | 'snowflake' | 'tiles' | 'spiral' | 'figures' | 'letters' | 'opart';

export const MOTIF_KINDS: readonly { kind: MotifKind; label: string }[] = [
  { kind: 'blobs', label: 'Kleckse' },
  { kind: 'sprite', label: 'Pixelfigur' },
  { kind: 'shapes', label: 'Geometrie' },
  { kind: 'waves', label: 'Wellen' },
  { kind: 'mandala', label: 'Mandala' },
  { kind: 'maze', label: 'Labyrinth' },
  { kind: 'landscape', label: 'Landschaft' },
  { kind: 'caves', label: 'Höhlen' },
  { kind: 'snowflake', label: 'Schneeflocke' },
  { kind: 'tiles', label: 'Fliesen' },
  { kind: 'spiral', label: 'Spirale' },
  { kind: 'figures', label: 'Figuren' },
  { kind: 'letters', label: 'Buchstaben' },
  { kind: 'opart', label: 'Op-Art' }
];

/** Zusätzliche Angaben für einzelne Motivarten. */
export interface MotifOptions {
  /** Text für „Buchstaben“; leer = zufälliges Wort. */
  text?: string;
}

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

type Painter = (w: number, h: number, rnd: Rng, opts: MotifOptions) => Uint8Array;

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

/** Hügel- oder Bergsilhouette mit Sonne bzw. Mond, Wolken und Tannen am Horizont. */
const landscape: Painter = (w, h, rnd) => {
  const p = new Uint8Array(w * h);
  const base = randRange(rnd, 0.5, 0.7) * h, amp = randRange(rnd, 0.08, 0.2) * h;
  const waves = Array.from({ length: 3 }, (_, k) => ({
    f: randRange(rnd, 0.5, 1.5) * (k + 1) * 2 * Math.PI / w, ph: randRange(rnd, 0, 2 * Math.PI), a: 1 / (k + 1)
  }));
  const ground = Array.from({ length: w }, (_, x) =>
    base - amp * waves.reduce((s, c) => s + c.a * Math.sin(c.f * x + c.ph), 0));
  for (let x = 0; x < w; x++) for (let y = Math.max(0, Math.round(ground[x])); y < h; y++) p[y * w + x] = 1;
  const set = (x: number, y: number) => { if (x >= 0 && y >= 0 && x < w && y < h) p[y * w + x] = 1; };
  // Tannen auf der Horizontlinie
  const trees = randInt(rnd, 0, 4), m = Math.min(w, h);
  for (let t = 0; t < trees; t++) {
    const tx = randInt(rnd, 1, w - 2), th = randRange(rnd, 0.1, 0.2) * h, tw = th * 0.35;
    const gy = ground[tx];
    for (let y = Math.floor(gy - th); y < gy; y++) {
      const half = tw * (y - (gy - th)) / th;
      for (let x = Math.round(tx - half); x <= Math.round(tx + half); x++) set(x, y);
    }
  }
  // Sonne bzw. Mondsichel im Himmel
  // Die Mondsichel braucht etwas mehr Größe, damit sie erkennbar bleibt
  const moon = rnd() < 0.4;
  const r = randRange(rnd, moon ? 0.12 : 0.08, moon ? 0.16 : 0.13) * m;
  const sx = randRange(rnd, 0.2, 0.8) * w, sy = randRange(rnd, 0.16, 0.26) * h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy);
    if (d <= r && (!moon || Math.hypot(x + 0.5 - sx - r * 0.5, y + 0.5 - sy + r * 0.3) > r * 0.8)) set(x, y);
  }
  // Wolken aus überlappenden Kreisen
  const clouds = randInt(rnd, 0, 2);
  for (let c = 0; c < clouds; c++) {
    const cx = randRange(rnd, 0.15, 0.85) * w, cy = randRange(rnd, 0.1, 0.3) * h, cr = randRange(rnd, 0.04, 0.07) * m;
    if (Math.hypot(cx - sx, cy - sy) < r + 3 * cr) continue;
    for (const [ox, oy, k] of [[-1.2, 0.3, 0.8], [0, 0, 1], [1.2, 0.3, 0.8]] as const) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (Math.hypot(x + 0.5 - (cx + ox * cr), y + 0.5 - (cy + oy * cr)) <= cr * k) set(x, y);
      }
    }
  }
  return p;
};

/** Höhlen: zellulärer Automat mit festem Rand – Gestein gefüllt, Hohlräume leer. */
const caves: Painter = (w, h, rnd) => {
  let p = new Uint8Array(w * h);
  const density = randRange(rnd, 0.4, 0.47);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    p[y * w + x] = x === 0 || y === 0 || x === w - 1 || y === h - 1 || rnd() < density ? 1 : 0;
  }
  // Außerhalb des Rasters zählt als Gestein; anfangs füllen sich auch große Leerflächen
  const count = (q: Uint8Array, x: number, y: number, r: number) => {
    let c = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = x + dx, yy = y + dy;
      c += xx < 0 || yy < 0 || xx >= w || yy >= h ? 1 : q[yy * w + xx];
    }
    return c;
  };
  const steps = randInt(rnd, 4, 5);
  for (let s = 0; s < steps; s++) {
    const next = new Uint8Array(p.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      next[y * w + x] = count(p, x, y, 1) >= 5 || (s < 2 && count(p, x, y, 2) <= 2) ? 1 : 0;
    }
    p = next;
  }
  return p;
};

/** Abstand eines Punktes von einer Strecke. */
function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

/** Schneeflocke bzw. Kristall: sechs- oder achtfach symmetrische Äste mit Seitenzweigen. */
const snowflake: Painter = (w, h, rnd) => {
  const p = new Uint8Array(w * h);
  const folds = pick(rnd, [6, 6, 8] as const);
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 0.5;
  const thick = Math.max(0.7, R * randRange(rnd, 0.06, 0.1));
  const branchAngle = folds === 6 ? Math.PI / 3 : Math.PI / 4;
  const branches = Array.from({ length: randInt(rnd, 1, 3) }, () =>
    ({ t: randRange(rnd, 0.3, 0.8), len: randRange(rnd, 0.15, 0.4) }));
  const core = randRange(rnd, 0.1, 0.25) * R;
  // Strecken eines Astes (Richtung 0), dann für alle Äste gedreht
  const arm: [number, number, number, number][] = [[0, 0, 1, 0]];
  for (const b of branches) {
    for (const sgn of [-1, 1]) {
      arm.push([b.t, 0, b.t + b.len * Math.cos(branchAngle), sgn * b.len * Math.sin(branchAngle)]);
    }
  }
  const segs: [number, number, number, number][] = [];
  for (let k = 0; k < folds; k++) {
    const a = (2 * Math.PI * k) / folds + Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
    for (const [x0, y0, x1, y1] of arm) {
      segs.push([cx + R * (x0 * c - y0 * s), cy + R * (x0 * s + y0 * c), cx + R * (x1 * c - y1 * s), cy + R * (x1 * s + y1 * c)]);
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = x + 0.5, py = y + 0.5;
    if (Math.hypot(px - cx, py - cy) <= core) { p[y * w + x] = 1; continue; }
    for (const [ax, ay, bx, by] of segs) {
      if (segmentDistance(px, py, ax, ay, bx, by) <= thick) { p[y * w + x] = 1; break; }
    }
  }
  return p;
};

/** Fliesen: eine symmetrische Kachel, über das ganze Raster wiederholt. */
const tiles: Painter = (w, h, rnd) => {
  const T = randInt(rnd, 4, Math.max(4, Math.min(12, Math.floor(Math.min(w, h) / 3))));
  const kinds = ['diamond', 'circle', 'ring', 'cross', 'corners', 'star'] as const;
  const parts = Array.from({ length: randInt(rnd, 1, 2) }, () => ({
    kind: pick(rnd, kinds), r: randRange(rnd, 0.22, 0.48), t: randRange(rnd, 0.1, 0.2)
  }));
  const checker = rnd() < 0.3;
  const tile = new Uint8Array(T * T);
  for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
    const u = (i + 0.5) / T - 0.5, v = (j + 0.5) / T - 0.5, au = Math.abs(u), av = Math.abs(v), d = Math.hypot(u, v);
    let val = 0;
    for (const { kind, r, t } of parts) {
      const inside = kind === 'diamond' ? au + av <= r
        : kind === 'circle' ? d <= r
          : kind === 'ring' ? d <= r && d >= r - t
            : kind === 'cross' ? Math.min(au, av) <= t / 1.5
              : kind === 'corners' ? Math.hypot(0.5 - au, 0.5 - av) <= r
                : Math.sqrt(au) + Math.sqrt(av) <= Math.sqrt(r) * 1.1;
      if (inside) val ^= 1;
    }
    tile[j * T + i] = val;
  }
  const p = new Uint8Array(w * h);
  // Kacheln mittig ausrichten, damit das Muster symmetrisch im Raster sitzt
  const ox = Math.floor((T - (w % T)) / 2) % T, oy = Math.floor((T - (h % T)) / 2) % T;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const tx = x + ox, ty = y + oy;
    const flip = checker && (Math.floor(tx / T) + Math.floor(ty / T)) % 2 === 1;
    p[y * w + x] = tile[(ty % T) * T + (tx % T)] ^ (flip ? 1 : 0);
  }
  return p;
};

/** Spirale mit einem oder mehreren Armen. */
const spiral: Painter = (w, h, rnd) => {
  const p = new Uint8Array(w * h);
  const R = Math.min(w, h) / 2;
  const arms = pick(rnd, [1, 1, 2, 3] as const), dir = rnd() < 0.5 ? 1 : -1;
  // Mindestens etwa 4 Felder pro Windung, damit die Arme nicht zu dünn werden
  const turns = randRange(rnd, 1.5, Math.max(1.6, R / 4)), duty = randRange(rnd, 0.4, 0.6);
  const cx = w / 2 + randRange(rnd, -0.1, 0.1) * w, cy = h / 2 + randRange(rnd, -0.1, 0.1) * h;
  const round = rnd() < 0.6;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = Math.hypot(dx, dy) / R;
    if (round && r > 0.98) continue;
    const t = Math.atan2(dy, dx) / (2 * Math.PI);
    const val = r * turns + dir * arms * t;
    p[y * w + x] = val - Math.floor(val) < duty ? 1 : 0;
  }
  return p;
};

/** Figuren: Silhouetten von Tieren und Gegenständen, einzeln groß oder als kleine Gruppe. */
const figures: Painter = (w, h, rnd) => {
  const p = new Uint8Array(w * h);
  const m = Math.min(w, h);
  const draw = (cx: number, cy: number, size: number) => {
    const { inside } = pick(rnd, SILHOUETTES);
    const flip = rnd() < 0.5 ? -1 : 1, half = size / 2;
    for (let y = Math.floor(cy - half); y < cy + half; y++) for (let x = Math.floor(cx - half); x < cx + half; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const u = ((x + 0.5 - cx) / half) * flip, v = (y + 0.5 - cy) / half;
      if (Math.abs(u) <= 1 && Math.abs(v) <= 1 && inside(u, v)) p[y * w + x] = 1;
    }
  };
  if (m < 20 || rnd() < 0.65) {
    draw(w / 2, h / 2, randRange(rnd, 0.82, 0.96) * m);
  } else {
    // Gruppe: 2–4 Figuren in verschiedenen Vierteln
    const quads = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
    for (let i = quads.length - 1; i > 0; i--) { const j = randInt(rnd, 0, i); [quads[i], quads[j]] = [quads[j], quads[i]]; }
    const n = randInt(rnd, 2, 4);
    for (let k = 0; k < n; k++) draw(quads[k][0] * w, quads[k][1] * h, randRange(rnd, 0.4, 0.48) * m);
  }
  return p;
};

const WORDS = ['HALLO', 'MOSAIK', 'RÄTSEL', 'LIEBE', 'GLÜCK', 'SONNE', 'HERZ', 'STERN', 'MOND', 'KATZE', 'HUND',
  'BAUM', 'HAUS', 'MAMA', 'PAPA', 'OMA', 'OPA', 'JA', 'OK', 'HI', 'ABC', '123', '2026', '♥', 'ZOO', 'UFO'];

/** Text in Zeilen aufteilen (Wörter zusammenhalten, sehr lange Wörter teilen). */
function splitLines(text: string, count: number): string[] {
  const words = text.split(' ');
  if (count === 1) return [text];
  if (words.length >= count) {
    // Wörter möglichst gleichmäßig auf die Zeilen verteilen
    const target = lineWidth(text) / count;
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && lineWidth(next) > target && lines.length < count - 1) { lines.push(line); line = word; } else line = next;
    }
    lines.push(line);
    return lines;
  }
  const chars = text.replace(/ /g, ''), per = Math.ceil(chars.length / count);
  return Array.from({ length: count }, (_, k) => chars.slice(k * per, (k + 1) * per)).filter(Boolean);
}

/** Beste Aufteilung in Zeilen: größtmögliche Schrift. */
function layoutText(text: string, w: number, h: number): { lines: string[]; scale: number } {
  let best = { lines: [text], scale: 0 };
  for (let count = 1; count <= Math.min(4, text.replace(/ /g, '').length); count++) {
    const lines = splitLines(text, count);
    const bw = Math.max(...lines.map(lineWidth)), bh = lines.length * GLYPH_H + (lines.length - 1) * 2;
    const scale = Math.floor(Math.min(w / bw, h / bh));
    if (scale > best.scale) best = { lines, scale };
  }
  return best;
}

/** Buchstaben und Zahlen in Blockschrift: eigener Text oder ein zufälliges Wort, ggf. mit Rahmen. */
const letters: Painter = (w, h, rnd, opts) => {
  const p = new Uint8Array(w * h);
  // Innenfläche ohne äußersten Ring, damit Platz für einen Rahmen bleibt
  const iw = w - 2, ih = h - 2;
  let text = normalizeText(opts.text ?? '');
  if (!text) {
    const fitting = WORDS.filter(word => layoutText(word, iw, ih).scale >= 1);
    text = fitting.length && rnd() < 0.8 ? pick(rnd, fitting)
      : String.fromCharCode(65 + randInt(rnd, 0, 25)) + (iw >= 11 ? String.fromCharCode(65 + randInt(rnd, 0, 25)) : '');
  }
  const { lines } = layoutText(text, iw, ih);
  const scale = Math.max(1, layoutText(text, iw, ih).scale);
  const lineH = GLYPH_H * scale, gap = 2 * scale;
  const blockH = lines.length * lineH + (lines.length - 1) * gap;
  let y0 = 1 + Math.floor((ih - blockH) / 2);
  for (const line of lines) {
    let x = 1 + Math.floor((iw - lineWidth(line) * scale) / 2);
    for (const c of line) {
      if (c === ' ') { x += 3 * scale; continue; }
      for (let gy = 0; gy < GLYPH_H; gy++) for (let gx = 0; gx < GLYPH_W; gx++) {
        if (!glyphPixel(c, gx, gy)) continue;
        for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
          const px = x + gx * scale + sx, py = y0 + gy * scale + sy;
          // Zu langer Text wird am Rand abgeschnitten
          if (px >= 1 && py >= 1 && px < w - 1 && py < h - 1) p[py * w + px] = 1;
        }
      }
      x += (GLYPH_W + 1) * scale;
    }
    y0 += lineH + gap;
  }
  // Rahmen, wenn das Motiv sonst zu hell wäre oder zufällig
  const fill = p.reduce((s, v) => s + v, 0) / p.length;
  if (fill < MIN_FILL || rnd() < 0.3) {
    for (let x = 0; x < w; x++) { p[x] = 1; p[(h - 1) * w + x] = 1; }
    for (let y = 0; y < h; y++) { p[y * w] = 1; p[y * w + w - 1] = 1; }
  }
  return p;
};

/** Op-Art: Streifen, Ringe oder Schachbrett, von einer Linse verzerrt, teils mit umgekehrtem Kreis. */
const opart: Painter = (w, h, rnd) => {
  const p = new Uint8Array(w * h);
  const m = Math.min(w, h);
  const type = pick(rnd, ['stripes', 'rings', 'checker'] as const);
  const period = randRange(rnd, 4, 7), half = period / 2;
  const bx = randRange(rnd, 0.3, 0.7) * w, by = randRange(rnd, 0.3, 0.7) * h;
  const S = randRange(rnd, 0.25, 0.45) * m, strength = randRange(rnd, 0.4, 0.7);
  const angle = randRange(rnd, 0, Math.PI), cos = Math.cos(angle), sin = Math.sin(angle);
  const invert = rnd() < 0.4, ir = randRange(rnd, 0.6, 1) * S;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x + 0.5 - bx, dy = y + 0.5 - by, d = Math.hypot(dx, dy);
    // Linse: in der Nähe des Mittelpunkts wird das Muster vergrößert
    const f = d < S ? (1 - (d / S) ** 2) ** 2 : 0;
    const k = 1 - strength * f;
    const lx = bx + dx * k, ly = by + dy * k;
    let val: number;
    if (type === 'stripes') val = Math.floor((lx * cos + ly * sin) / half);
    else if (type === 'rings') val = Math.floor(Math.hypot(lx - w / 2, ly - h / 2) / half);
    else val = Math.floor(lx / half) + Math.floor(ly / half);
    let bit = ((val % 2) + 2) % 2;
    if (invert && d <= ir) bit ^= 1;
    p[y * w + x] = bit;
  }
  return p;
};

const PAINTERS: Record<MotifKind, Painter> = {
  blobs, sprite, shapes, waves, mandala, maze, landscape, caves, snowflake, tiles, spiral, figures, letters, opart
};

const fillOf = (p: Uint8Array) => p.reduce((s, v) => s + v, 0) / p.length;

/**
 * Erzeugt ein Motiv. Bei „any“ wird die Art zufällig gewählt.
 * Motive mit zu wenig oder zu viel Fläche werden mit abgeleitetem Startwert neu erzeugt.
 */
export function generateMotif(kind: MotifKind | 'any', width: number, height: number, seed: number,
  opts: MotifOptions = {}): Motif {
  const chooser = createRng(seed ^ 0x9e3779b9);
  let best: Motif | null = null, bestDist = Infinity;
  for (let attempt = 0; attempt < 12; attempt++) {
    const k = kind === 'any' ? pick(chooser, MOTIF_KINDS).kind : kind;
    const s = (seed + attempt * 7919) >>> 0;
    const pattern = PAINTERS[k](width, height, createRng(s), opts);
    const fill = fillOf(pattern);
    const maxFill = MAX_FILL_BY_KIND[k] ?? MAX_FILL;
    if (fill >= MIN_FILL && fill <= maxFill) return { kind: k, seed: s, pattern };
    const dist = fill < MIN_FILL ? MIN_FILL - fill : fill - maxFill;
    if (dist < bestDist) { bestDist = dist; best = { kind: k, seed: s, pattern }; }
  }
  return best!;
}
