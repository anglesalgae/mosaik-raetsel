import { Cell, type Contradiction, type Deduction, type DecidedState, type SolveOutcome } from './types';

/**
 * Vorberechnete Struktur eines Rätsels für den Löser.
 * Zellzustände: 0 = offen, 1 = gefüllt, 2 = leer (siehe Cell).
 */
export interface Model {
  width: number;
  height: number;
  size: number;
  clues: Int8Array;
  /** 3×3-Nachbarschaft (inkl. Feld selbst) für jedes Feld. */
  neighbors: number[][];
  /** Indizes aller Felder mit Zahl. */
  clueCells: number[];
  /** Paare von Zahlen, deren Blöcke sich überschneiden (flach: a0,b0,a1,b1,…). */
  pairs: Int32Array;
  /** 1, wenn das Feld im Block mindestens einer Zahl liegt. */
  covered: Uint8Array;
  /** Anzahl Felder ohne jede Zahl in der Nähe (dann ist die Lösung nicht eindeutig). */
  uncovered: number;
}

export function buildModel(width: number, height: number, clues: Int8Array): Model {
  const size = width * height;
  const neighbors: number[][] = new Array(size);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const list: number[] = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < width && yy < height) list.push(yy * width + xx);
        }
      }
      neighbors[y * width + x] = list;
    }
  }
  const clueCells: number[] = [];
  for (let i = 0; i < size; i++) if (clues[i] >= 0) clueCells.push(i);

  const pairs: number[] = [];
  for (const a of clueCells) {
    const ax = a % width, ay = Math.floor(a / width);
    for (let dy = 0; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dy === 0 && dx <= 0) continue;
        const x = ax + dx, y = ay + dy;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const b = y * width + x;
        if (clues[b] >= 0) pairs.push(a, b);
      }
    }
  }

  const covered = new Uint8Array(size);
  for (const c of clueCells) for (const j of neighbors[c]) covered[j] = 1;
  let uncovered = 0;
  for (let i = 0; i < size; i++) if (!covered[i]) uncovered++;

  return { width, height, size, clues, neighbors, clueCells, pairs: Int32Array.from(pairs), covered, uncovered };
}

/** Wie viele Felder braucht die Zahl noch, und welche Felder sind noch offen? */
export function analyzeClue(m: Model, st: ArrayLike<number>, clue: number): { need: number; open: number[] } {
  let filled = 0;
  const open: number[] = [];
  for (const j of m.neighbors[clue]) {
    const v = st[j];
    if (v === Cell.Filled) filled++;
    else if (v === Cell.Unknown) open.push(j);
  }
  return { need: m.clues[clue] - filled, open };
}

function findSimple(m: Model, st: ArrayLike<number>): Deduction | Contradiction | null {
  for (const c of m.clueCells) {
    const { need, open } = analyzeClue(m, st, c);
    if (need < 0 || need > open.length) return { kind: 'contradiction', clues: [c] };
    if (!open.length) continue;
    if (need === 0) return { kind: 'deduction', cells: open, value: Cell.Empty, clues: [c], rule: 'zero' };
    if (need === open.length) return { kind: 'deduction', cells: open, value: Cell.Filled, clues: [c], rule: 'full' };
  }
  return null;
}

/**
 * Vergleich zweier Zahlen mit überlappenden Blöcken: Aus Ober- und Untergrenze
 * der gefüllten Felder im gemeinsamen Bereich folgt oft etwas für die übrigen Felder.
 */
function findPair(m: Model, st: ArrayLike<number>): Deduction | Contradiction | null {
  const p = m.pairs;
  for (let k = 0; k < p.length; k += 2) {
    const a = p[k], b = p[k + 1];
    const A = analyzeClue(m, st, a);
    if (!A.open.length) continue;
    const B = analyzeClue(m, st, b);
    if (!B.open.length) continue;

    const inA = new Set(A.open), inB = new Set(B.open);
    const shared = A.open.filter(j => inB.has(j));
    if (!shared.length) continue;
    const onlyA = A.open.filter(j => !inB.has(j));
    const onlyB = B.open.filter(j => !inA.has(j));

    const minShared = Math.max(0, A.need - onlyA.length, B.need - onlyB.length);
    const maxShared = Math.min(shared.length, A.need, B.need);
    if (minShared > maxShared) return { kind: 'contradiction', clues: [a, b] };

    const result = (cells: number[], value: DecidedState): Deduction =>
      ({ kind: 'deduction', cells, value, clues: [a, b], rule: 'pair' });

    if (onlyA.length) {
      if (A.need - maxShared >= onlyA.length) return result(onlyA, Cell.Filled);
      if (A.need - minShared <= 0) return result(onlyA, Cell.Empty);
    }
    if (onlyB.length) {
      if (B.need - maxShared >= onlyB.length) return result(onlyB, Cell.Filled);
      if (B.need - minShared <= 0) return result(onlyB, Cell.Empty);
    }
    if (minShared === shared.length) return result(shared, Cell.Filled);
    if (maxShared === 0) return result(shared, Cell.Empty);
  }
  return null;
}

/** Nächster logischer Schritt (oder ein Widerspruch) für den aktuellen Stand. */
export function findDeduction(m: Model, st: ArrayLike<number>): Deduction | Contradiction | null {
  return findSimple(m, st) ?? findPair(m, st);
}

/** Wendet alle logischen Schlüsse an (verändert st). false = Widerspruch. */
export function propagate(m: Model, st: Uint8Array): boolean {
  for (;;) {
    let changed = false;
    for (const c of m.clueCells) {
      let filled = 0, open = 0;
      const nb = m.neighbors[c];
      for (const j of nb) {
        const v = st[j];
        if (v === Cell.Filled) filled++;
        else if (v === Cell.Unknown) open++;
      }
      const need = m.clues[c] - filled;
      if (need < 0 || need > open) return false;
      if (open === 0) continue;
      if (need === 0 || need === open) {
        const val = need === 0 ? Cell.Empty : Cell.Filled;
        for (const j of nb) if (st[j] === Cell.Unknown) st[j] = val;
        changed = true;
      }
    }
    if (changed) continue;
    const d = findPair(m, st);
    if (!d) return true;
    if (d.kind === 'contradiction') return false;
    for (const j of d.cells) st[j] = d.value;
  }
}

/** Lässt sich das Rätsel ohne Ausprobieren vollständig lösen? */
export function isLogicSolvable(m: Model): boolean {
  const st = new Uint8Array(m.size);
  if (!propagate(m, st)) return false;
  for (let i = 0; i < m.size; i++) if (st[i] === Cell.Unknown && m.covered[i]) return false;
  return true;
}

export interface SolveOptions {
  maxSolutions?: number;
  nodeLimit?: number;
}

/** Vollständige Suche (Logik + Backtracking). Findet bis zu maxSolutions Lösungen. */
export function solve(m: Model, opts: SolveOptions = {}): SolveOutcome {
  const maxSolutions = opts.maxSolutions ?? 2;
  const nodeLimit = opts.nodeLimit ?? 60000;
  let nodes = 0, aborted = false;
  const solutions: Uint8Array[] = [];

  const rec = (st: Uint8Array): void => {
    if (solutions.length >= maxSolutions || aborted) return;
    if (++nodes > nodeLimit) { aborted = true; return; }
    if (!propagate(m, st)) return;

    // Zahl mit den wenigsten offenen Feldern als Verzweigungspunkt
    let best = -1, bestOpen = Infinity;
    for (const c of m.clueCells) {
      let open = 0;
      for (const j of m.neighbors[c]) if (st[j] === Cell.Unknown) open++;
      if (open > 0 && open < bestOpen) { bestOpen = open; best = c; if (open <= 2) break; }
    }
    if (best < 0) {
      const s = Uint8Array.from(st);
      for (let i = 0; i < s.length; i++) if (s[i] === Cell.Unknown) s[i] = Cell.Empty;
      solutions.push(s);
      return;
    }
    const cell = m.neighbors[best].find(j => st[j] === Cell.Unknown)!;
    for (const v of [Cell.Filled, Cell.Empty]) {
      const next = Uint8Array.from(st);
      next[cell] = v;
      rec(next);
      if (solutions.length >= maxSolutions || aborted) return;
    }
  };
  rec(new Uint8Array(m.size));

  let status: SolveOutcome['status'];
  if (!solutions.length) status = aborted ? 'limit' : 'none';
  else if (solutions.length > 1 || m.uncovered > 0) status = 'multiple';
  else status = aborted ? 'limit' : 'unique';

  return { status, solution: solutions[0] ?? null, logicSolvable: status === 'unique' && isLogicSolvable(m) };
}

/** Erfüllt die Belegung (Cell.Filled = gefüllt) alle Zahlen exakt? */
export function satisfies(m: Model, cells: ArrayLike<number>): boolean {
  for (const c of m.clueCells) {
    let f = 0;
    for (const j of m.neighbors[c]) if (cells[j] === Cell.Filled) f++;
    if (f !== m.clues[c]) return false;
  }
  return true;
}
