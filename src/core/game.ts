import { Emitter } from './emitter';
import { buildModel, satisfies, type Model } from './solver';
import { Cell, type Change, type CellState, type ParsedFile, type Puzzle, type SolveOutcome, type SolveStatus } from './types';

export const ClueStatus = { Open: 0, Done: 1, Error: 2 } as const;
export type ClueStatus = (typeof ClueStatus)[keyof typeof ClueStatus];

export interface GameEvents extends Record<string, unknown> {
  /** Neues Rätsel geladen. */
  load: { fromProgress: boolean };
  /** Zellen haben sich geändert (Zug, Rückgängig, …). */
  change: { changes: readonly Change[] };
  /** Ergebnis des Lösers liegt vor. */
  solution: { status: SolveStatus; note: string | null };
  /** Rätsel wurde gerade gelöst. */
  solved: { elapsedSeconds: number };
  /** Spielzeit hat sich geändert. */
  tick: { elapsedSeconds: number };
}

const MAX_UNDO = 2000;

/**
 * Spielzustand: Rätsel, Zellen, Verlauf, Zeit und Lösungsinformation.
 * Kennt keine Oberfläche – Ansichten hören auf Events.
 */
export class Game extends Emitter<GameEvents> {
  puzzle!: Puzzle;
  model!: Model;
  cells: Uint8Array = new Uint8Array(0);
  /** Bekannte, eindeutige Lösung (aus Datei oder berechnet). */
  solution: Uint8Array | null = null;
  solveStatus: SolveStatus = 'pending';
  logicSolvable = false;
  elapsedSeconds = 0;
  solved = false;

  private undoStack: Change[][] = [];
  private redoStack: Change[][] = [];

  get loaded(): boolean { return this.cells.length > 0; }
  get width(): number { return this.puzzle.width; }
  get height(): number { return this.puzzle.height; }
  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }

  load({ puzzle, progress }: ParsedFile): void {
    this.puzzle = puzzle;
    this.model = buildModel(puzzle.width, puzzle.height, puzzle.clues);
    this.cells = progress ? Uint8Array.from(progress.cells) : new Uint8Array(puzzle.width * puzzle.height);
    this.elapsedSeconds = progress?.elapsedSeconds ?? 0;
    this.solution = null;
    this.solveStatus = 'pending';
    this.logicSolvable = false;
    this.undoStack = [];
    this.redoStack = [];
    this.solved = this.checkSolved();
    this.emit('load', { fromProgress: !!progress });
  }

  /** Übernimmt das Ergebnis des Lösers und gleicht es mit der Lösung aus der Datei ab. */
  applySolveOutcome(outcome: SolveOutcome): void {
    this.solveStatus = outcome.status;
    this.logicSolvable = outcome.logicSolvable;
    let note: string | null = null;
    const fileSol = this.puzzle.solution;
    if (fileSol) {
      if (satisfies(this.model, fileSol)) this.solution = fileSol;
      else {
        this.solution = outcome.status === 'unique' ? outcome.solution : null;
        note = 'Die mitgelieferte Lösung passt nicht zu den Zahlen.';
      }
    } else {
      this.solution = outcome.status === 'unique' ? outcome.solution : null;
    }
    const wasSolved = this.solved;
    this.solved = this.checkSolved();
    this.emit('solution', { status: this.solveStatus, note });
    if (this.solved && !wasSolved) this.emit('solved', { elapsedSeconds: this.elapsedSeconds });
  }

  /** Setzt Zellen auf einen Wert, ohne zu speichern. Gibt die Änderungen zurück. */
  setCells(indices: Iterable<number>, value: CellState): Change[] {
    const changes: Change[] = [];
    for (const i of indices) {
      const from = this.cells[i] as CellState;
      if (from !== value) {
        changes.push([i, from, value]);
        this.cells[i] = value;
      }
    }
    return changes;
  }

  /** Setzt eine einzelne Zelle (für Mal-Gesten); wird später per commit() gebündelt. */
  setCellRaw(i: number, value: CellState): void {
    this.cells[i] = value;
  }

  /** Übernimmt bereits angewendete Änderungen als einen Schritt in den Verlauf. */
  commit(changes: Change[]): void {
    if (!changes.length) return;
    this.undoStack.push(changes);
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.redoStack = [];
    this.afterChange(changes);
  }

  /** Setzt Zellen und speichert das als einen Schritt. */
  set(indices: Iterable<number>, value: CellState): Change[] {
    const ch = this.setCells(indices, value);
    this.commit(ch);
    return ch;
  }

  undo(): void {
    const ch = this.undoStack.pop();
    if (!ch) return;
    for (let k = ch.length - 1; k >= 0; k--) this.cells[ch[k][0]] = ch[k][1];
    this.redoStack.push(ch);
    this.afterChange(ch);
  }

  redo(): void {
    const ch = this.redoStack.pop();
    if (!ch) return;
    for (const [i, , to] of ch) this.cells[i] = to;
    this.undoStack.push(ch);
    this.afterChange(ch);
  }

  /** Leert das Spielfeld (rückgängig machbar) und setzt die Zeit zurück. */
  reset(): number {
    const all = Array.from({ length: this.cells.length }, (_, i) => i);
    const ch = this.setCells(all, Cell.Unknown);
    this.elapsedSeconds = 0;
    this.commit(ch);
    this.emit('tick', { elapsedSeconds: 0 });
    return ch.length;
  }

  /** Trägt die bekannte Lösung vollständig ein. */
  fillSolution(): number {
    const sol = this.solution;
    if (!sol) return 0;
    const changes: Change[] = [];
    for (let i = 0; i < this.cells.length; i++) {
      const to: CellState = sol[i] === Cell.Filled ? Cell.Filled : Cell.Empty;
      const from = this.cells[i] as CellState;
      if (from !== to) { changes.push([i, from, to]); this.cells[i] = to; }
    }
    this.commit(changes);
    return changes.length;
  }

  /** Eine Sekunde Spielzeit hinzufügen (nur solange nicht gelöst). */
  tick(): void {
    if (!this.loaded || this.solved) return;
    this.elapsedSeconds++;
    this.emit('tick', { elapsedSeconds: this.elapsedSeconds });
  }

  /** Status jeder Zahl: offen, erfüllt (alle gefüllt) oder Widerspruch. */
  clueStatuses(): Map<number, ClueStatus> {
    const out = new Map<number, ClueStatus>();
    for (const c of this.model.clueCells) {
      let filled = 0, open = 0;
      for (const j of this.model.neighbors[c]) {
        const v = this.cells[j];
        if (v === Cell.Filled) filled++;
        else if (v === Cell.Unknown) open++;
      }
      const need = this.model.clues[c] - filled;
      out.set(c, need < 0 || need > open ? ClueStatus.Error : need === 0 ? ClueStatus.Done : ClueStatus.Open);
    }
    return out;
  }

  /** Felder, die der bekannten Lösung widersprechen. */
  wrongCells(): number[] {
    const sol = this.solution;
    if (!sol) return [];
    const out: number[] = [];
    for (let i = 0; i < this.cells.length; i++) {
      const v = this.cells[i];
      if ((v === Cell.Filled && sol[i] !== Cell.Filled) || (v === Cell.Empty && sol[i] === Cell.Filled)) out.push(i);
    }
    return out;
  }

  /** Anteil entschiedener Felder (0…1). */
  progress(): number {
    if (!this.cells.length) return 0;
    let decided = 0;
    for (const v of this.cells) if (v !== Cell.Unknown) decided++;
    return decided / this.cells.length;
  }

  private checkSolved(): boolean {
    if (!this.loaded) return false;
    const sol = this.solution;
    if (sol) {
      for (let i = 0; i < this.cells.length; i++) {
        if ((sol[i] === Cell.Filled) !== (this.cells[i] === Cell.Filled)) return false;
      }
      return true;
    }
    if (this.solveStatus === 'multiple' || this.model.clueCells.length === 0) return false;
    return satisfies(this.model, this.cells);
  }

  private afterChange(changes: readonly Change[]): void {
    const wasSolved = this.solved;
    this.solved = this.checkSolved();
    this.emit('change', { changes });
    if (this.solved && !wasSolved) this.emit('solved', { elapsedSeconds: this.elapsedSeconds });
  }
}
