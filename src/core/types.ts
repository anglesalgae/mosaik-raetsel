/** Zustand eines Feldes. */
export const Cell = { Unknown: 0, Filled: 1, Empty: 2 } as const;
export type CellState = (typeof Cell)[keyof typeof Cell];
/** Ein festgelegter Wert (gefüllt oder leer). */
export type DecidedState = typeof Cell.Filled | typeof Cell.Empty;

/** Ein Rätsel, wie es aus einer Datei gelesen wurde. */
export interface Puzzle {
  width: number;
  height: number;
  /** Zahl pro Feld, -1 = keine Zahl. Zeilenweise, Index = y * width + x. */
  clues: Int8Array;
  /** Optionale Lösung aus der Datei (Werte: Cell.Filled / Cell.Empty). */
  solution: Uint8Array | null;
  title: string;
  author: string;
  /** Weitere bekannte Metadaten, die beim Speichern erhalten bleiben. */
  extra: Record<string, unknown>;
}

export interface Progress {
  cells: Uint8Array;
  elapsedSeconds: number;
}

export interface ParsedFile {
  puzzle: Puzzle;
  progress: Progress | null;
}

/** Struktur der gespeicherten JSON-Datei. */
export interface SaveFile {
  format: 'fill-a-pix';
  version: 1;
  title: string;
  author?: string;
  width: number;
  height: number;
  clues: string[];
  solution?: string[];
  progress?: {
    cells: string[];
    elapsedSeconds: number;
    solved: boolean;
    savedAt: string;
  };
  [key: string]: unknown;
}

/** Eine Zelländerung: [Index, vorher, nachher]. */
export type Change = readonly [index: number, from: CellState, to: CellState];

export type SolveStatus = 'pending' | 'unique' | 'multiple' | 'none' | 'limit';

export interface SolveOutcome {
  status: Exclude<SolveStatus, 'pending'>;
  solution: Uint8Array | null;
  logicSolvable: boolean;
}

export type DeductionRule = 'zero' | 'full' | 'pair';

export interface Deduction {
  kind: 'deduction';
  cells: number[];
  value: DecidedState;
  clues: number[];
  rule: DeductionRule;
}

export interface Contradiction {
  kind: 'contradiction';
  clues: number[];
}
