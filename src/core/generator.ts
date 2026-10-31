import { createRng } from './random';
import { buildModel, solve } from './solver';
import { Cell } from './types';

/**
 * Schwierigkeit beim Ausdünnen der Zahlen:
 * - easy:     nur einfache Schlüsse (Zahl erfüllt / alle freien Felder nötig)
 * - moderate: zusätzlich sehr wenige Vergleiche zweier überlappender Zahlen
 * - medium:   beliebig viele Vergleiche
 */
export type GeneratorLevel = 'easy' | 'moderate' | 'medium';

/** Stufen von leicht nach schwer. */
export const GENERATOR_LEVELS: readonly GeneratorLevel[] = ['easy', 'moderate', 'medium'];

/** Vergleich zweier Stufen: < 0 wenn a leichter als b ist. */
export const compareLevels = (a: GeneratorLevel, b: GeneratorLevel): number =>
  GENERATOR_LEVELS.indexOf(a) - GENERATOR_LEVELS.indexOf(b);

/** Höchstzahl an Vergleichen für „moderate“: 2 bei kleinen Rätseln, höchstens 6 bei großen. */
export function comparisonBudget(width: number, height: number): number {
  return Math.max(2, Math.min(6, Math.round((width * height) / 120)));
}

/** Stufe, die zu einer Anzahl nötiger Vergleiche gehört. */
export function levelForComparisons(comparisons: number, width: number, height: number): GeneratorLevel {
  return comparisons === 0 ? 'easy' : comparisons <= comparisonBudget(width, height) ? 'moderate' : 'medium';
}

function maxComparisons(level: GeneratorLevel, width: number, height: number): number {
  return level === 'easy' ? 0 : level === 'moderate' ? comparisonBudget(width, height) : Infinity;
}

export interface GenerateOptions {
  level: GeneratorLevel;
  seed?: number;
  /** Fortschritt 0…1 (wird gelegentlich aufgerufen). */
  onProgress?: (fraction: number) => void;
}

export interface GenerateResult {
  clues: Int8Array;
  clueCount: number;
  /** Gewünschte Stufe. */
  requestedLevel: GeneratorLevel;
  /** Tatsächliche Stufe nach Zahl der Vergleiche (kann von der gewünschten abweichen). */
  level: GeneratorLevel;
  /** Anzahl der Vergleiche zweier Zahlen, die der Lösungsweg des Generators braucht. */
  comparisons: number;
  /**
   * logic:     eindeutig und ohne Raten lösbar
   * guessing:  eindeutig, braucht aber Ausprobieren (alle Zahlen bleiben stehen)
   * ambiguous: das Bild hat mehrere Lösungen
   */
  quality: 'logic' | 'guessing' | 'ambiguous';
}

function neighborhoods(w: number, h: number): Int32Array[] {
  const out: Int32Array[] = new Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const list: number[] = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h) list.push(yy * w + xx);
      }
      out[y * w + x] = Int32Array.from(list);
    }
  }
  return out;
}

/** Zahl für jedes Feld: Anzahl gefüllter Felder im 3×3-Block. pattern: 1 = gefüllt. */
export function fullClues(w: number, h: number, pattern: ArrayLike<number>): Int8Array {
  const nb = neighborhoods(w, h);
  const clues = new Int8Array(w * h);
  for (let i = 0; i < clues.length; i++) {
    let c = 0;
    for (const j of nb[i]) if (pattern[j] === 1) c++;
    clues[i] = c;
  }
  return clues;
}

/**
 * Schneller Prüfer, ob ein Satz von Zahlen das Rätsel ohne Raten vollständig festlegt.
 * Nutzt eine Arbeitsliste, damit nur betroffene Zahlen erneut geprüft werden.
 */
class LogicChecker {
  private readonly n: number;
  private readonly nb: Int32Array[];
  /** Für jedes Feld die Felder im Abstand ≤ 2 (mögliche Partner für die Paar-Regel). */
  private readonly partners: Int32Array[];
  private readonly st: Uint8Array;
  private readonly stack: Int32Array;
  private readonly inStack: Uint8Array;
  private readonly dirty: Int32Array;
  private readonly isDirty: Uint8Array;
  private dirtyTop = 0;
  private readonly openA: number[] = [];
  private readonly openB: number[] = [];

  constructor(w: number, h: number) {
    this.n = w * h;
    this.nb = neighborhoods(w, h);
    this.partners = new Array(this.n);
    for (let a = 0; a < this.n; a++) {
      const ax = a % w, ay = Math.floor(a / w);
      const list: number[] = [];
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (!dx && !dy) continue;
        const x = ax + dx, y = ay + dy;
        if (x >= 0 && y >= 0 && x < w && y < h) list.push(y * w + x);
      }
      this.partners[a] = Int32Array.from(list);
    }
    this.st = new Uint8Array(this.n);
    this.stack = new Int32Array(this.n);
    this.inStack = new Uint8Array(this.n);
    this.dirty = new Int32Array(this.n);
    this.isDirty = new Uint8Array(this.n);
  }

  /** Anzahl der Vergleiche beim letzten Aufruf von solvable(). */
  comparisons = 0;

  /**
   * Prüft, ob die Zahlen das Raster ohne Raten vollständig festlegen.
   * maxComparisons: erlaubte Vergleiche zweier Zahlen (0 = nur einfache Schlüsse).
   */
  solvable(clues: Int8Array, maxComparisons: number): boolean {
    const { n, nb, st, stack, inStack, dirty, isDirty } = this;
    const usePairs = maxComparisons > 0;
    this.comparisons = 0;
    st.fill(Cell.Unknown);
    inStack.fill(0);
    isDirty.fill(0);
    let top = 0;
    this.dirtyTop = 0;
    const push = (c: number) => {
      if (clues[c] < 0) return;
      if (!inStack[c]) { inStack[c] = 1; stack[top++] = c; }
      if (usePairs && !isDirty[c]) { isDirty[c] = 1; dirty[this.dirtyTop++] = c; }
    };
    const set = (j: number, v: number) => {
      st[j] = v;
      for (const k of nb[j]) push(k);
    };
    for (let c = 0; c < n; c++) push(c);

    for (;;) {
      while (top > 0) {
        const c = stack[--top];
        inStack[c] = 0;
        let filled = 0, open = 0;
        for (const j of nb[c]) { const v = st[j]; if (v === Cell.Filled) filled++; else if (v === Cell.Unknown) open++; }
        const need = clues[c] - filled;
        if (need < 0 || need > open) return false;
        if (open && (need === 0 || need === open)) {
          const val = need === 0 ? Cell.Empty : Cell.Filled;
          for (const j of nb[c]) if (st[j] === Cell.Unknown) set(j, val);
        }
      }
      if (!usePairs || this.comparisons >= maxComparisons) break;
      if (!this.pairStep(clues, set)) break;
      this.comparisons++;
    }
    for (let i = 0; i < n; i++) if (st[i] === Cell.Unknown) return false;
    return true;
  }

  /**
   * Sucht eine Folgerung aus zwei überlappenden Zahlen und wendet sie an.
   * Geprüft werden nur Zahlen, in deren Block sich seit der letzten Prüfung etwas geändert hat.
   */
  private pairStep(clues: Int8Array, set: (j: number, v: number) => void): boolean {
    const { nb, st, dirty, isDirty, partners, openA, openB } = this;
    while (this.dirtyTop > 0) {
      const a = dirty[this.dirtyTop - 1];
      let fa = 0;
      openA.length = 0;
      for (const j of nb[a]) { const v = st[j]; if (v === Cell.Filled) fa++; else if (v === Cell.Unknown) openA.push(j); }
      if (openA.length) {
        const needA = clues[a] - fa;
        for (const b of partners[a]) {
          if (clues[b] < 0) continue;
          let fb = 0;
          openB.length = 0;
          for (const j of nb[b]) { const v = st[j]; if (v === Cell.Filled) fb++; else if (v === Cell.Unknown) openB.push(j); }
          if (!openB.length) continue;
          const needB = clues[b] - fb;
          let shared = 0;
          for (const j of openA) if (openB.includes(j)) shared++;
          if (!shared) continue;
          const onlyA = openA.length - shared, onlyB = openB.length - shared;
          const minS = Math.max(0, needA - onlyA, needB - onlyB);
          const maxS = Math.min(shared, needA, needB);

          let cells: number[] | null = null, val = 0;
          if (onlyA && needA - maxS >= onlyA) { cells = openA.filter(j => !openB.includes(j)); val = Cell.Filled; }
          else if (onlyA && needA - minS <= 0) { cells = openA.filter(j => !openB.includes(j)); val = Cell.Empty; }
          else if (onlyB && needB - maxS >= onlyB) { cells = openB.filter(j => !openA.includes(j)); val = Cell.Filled; }
          else if (onlyB && needB - minS <= 0) { cells = openB.filter(j => !openA.includes(j)); val = Cell.Empty; }
          else if (minS === shared) { cells = openA.filter(j => openB.includes(j)); val = Cell.Filled; }
          else if (maxS === 0) { cells = openA.filter(j => openB.includes(j)); val = Cell.Empty; }
          if (cells) {
            for (const j of cells) set(j, val);
            return true;
          }
        }
      }
      // Nichts gefunden: Zahl ist erst wieder interessant, wenn sich ihr Block ändert
      this.dirtyTop--;
      isDirty[a] = 0;
    }
    return false;
  }
}

/** Prüft ein beliebiges Rätsel und ordnet es einer Stufe zu (null = nicht ohne Raten lösbar). */
export function classifyDifficulty(width: number, height: number, clues: Int8Array): GeneratorLevel | null {
  return classifyPuzzle(width, height, clues)?.level ?? null;
}

/** Wie classifyDifficulty, liefert zusätzlich die Zahl der nötigen Vergleiche. */
export function classifyPuzzle(width: number, height: number, clues: Int8Array):
  { level: GeneratorLevel; comparisons: number } | null {
  const checker = new LogicChecker(width, height);
  for (const level of GENERATOR_LEVELS) {
    if (checker.solvable(clues, maxComparisons(level, width, height))) return { level, comparisons: checker.comparisons };
  }
  return null;
}

/** Besonders schwer: mehr Vergleiche als ein Viertel der Zahlen – dann gibt es einen Totenschädel. */
export function isDeadly(comparisons: number, clueCount: number): boolean {
  return comparisons > clueCount / 4;
}

/**
 * Schneller Vorab-Test: Kann aus diesem Raster überhaupt ein Rätsel der gewünschten Stufe
 * (oder leichter) entstehen? Geprüft wird das Rätsel mit allen Zahlen.
 */
export function canReachLevel(width: number, height: number, pattern: ArrayLike<number>, level: GeneratorLevel): boolean {
  const full = classifyDifficulty(width, height, fullClues(width, height, pattern));
  return full !== null && compareLevels(full, level) <= 0;
}

export const isGeneratorLevel = (v: unknown): v is GeneratorLevel =>
  typeof v === 'string' && (GENERATOR_LEVELS as readonly string[]).includes(v);

const count = (clues: Int8Array) => clues.reduce((s, v) => s + (v >= 0 ? 1 : 0), 0);

/**
 * Erzeugt Zahlen für ein Bild. Startet mit allen Zahlen und entfernt sie in
 * zufälliger Reihenfolge, solange das Rätsel ohne Raten lösbar bleibt.
 */
export function generatePuzzle(w: number, h: number, pattern: ArrayLike<number>, opts: GenerateOptions): GenerateResult {
  const full = fullClues(w, h, pattern);
  const checker = new LogicChecker(w, h);

  // Gewünschte Stufe; reicht sie selbst mit allen Zahlen nicht, die nächstschwerere nehmen
  let level: GeneratorLevel | null = null;
  for (const l of GENERATOR_LEVELS.slice(GENERATOR_LEVELS.indexOf(opts.level))) {
    if (checker.solvable(full, maxComparisons(l, w, h))) { level = l; break; }
  }
  if (!level) {
    // Nicht ohne Raten lösbar: Eindeutigkeit per Suche prüfen und alle Zahlen behalten
    const res = solve(buildModel(w, h, full), { maxSolutions: 2, nodeLimit: 200_000 });
    opts.onProgress?.(1);
    return {
      clues: full, clueCount: full.length, requestedLevel: opts.level, level: 'medium', comparisons: 0,
      quality: res.status === 'unique' ? 'guessing' : 'ambiguous'
    };
  }
  const budget = maxComparisons(level, w, h);

  const rnd = createRng(opts.seed ?? 1);
  const order = Array.from({ length: full.length }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const clues = Int8Array.from(full);
  // Erst in Blöcken entfernen (schnell, solange vieles überflüssig ist), Fehlschläge einzeln nachprüfen
  const CHUNK = 8;
  let done = 0;
  for (let k = 0; k < order.length; k += CHUNK) {
    const chunk = order.slice(k, k + CHUNK);
    const saved = chunk.map(i => clues[i]);
    for (const i of chunk) clues[i] = -1;
    if (!checker.solvable(clues, budget)) {
      chunk.forEach((i, idx) => { clues[i] = saved[idx]; });
      for (const i of chunk) {
        const v = clues[i];
        clues[i] = -1;
        if (!checker.solvable(clues, budget)) clues[i] = v;
      }
    }
    done += chunk.length;
    if (opts.onProgress && (k / CHUNK) % 8 === 0) opts.onProgress(done / order.length);
  }
  checker.solvable(clues, budget);
  const comparisons = checker.comparisons;
  opts.onProgress?.(1);
  return {
    clues, clueCount: count(clues), requestedLevel: opts.level, comparisons, quality: 'logic',
    // Tatsächliche Stufe nach Zahl der Vergleiche (kann leichter ausfallen als angefordert)
    level: levelForComparisons(comparisons, w, h)
  };
}
