import { Cell, type CellState } from '../core/types';

/** Hervorhebungen auf dem Spielfeld (Hinweise, Fehler, Widersprüche). */
export interface Marks {
  cells: number[];
  clues: number[];
  error: boolean;
}

/** Zustand der Ansicht, der nicht zum Spielstand gehört. */
export interface ViewState {
  /** Aktives Werkzeug: Filled, Empty oder Unknown (= Radieren). */
  tool: CellState;
  zoom: number;
  hover: number;
  cursor: number;
  keyboard: boolean;
  marks: Marks | null;
  /** Einmalig über „Prüfen“ markierte Fehler. */
  checkedErrors: number[] | null;
  liveErrors: boolean;
  showNumbers: boolean;
  /** Fortschritt der Lösungsanimation (0…1). */
  reveal: number;
  /** Lösung wird angezeigt (nur Ansicht – der Spielstand bleibt unverändert). */
  showSolution: boolean;
}

export function createViewState(): ViewState {
  return {
    tool: Cell.Filled, zoom: 1, hover: -1, cursor: -1, keyboard: false,
    marks: null, checkedErrors: null, liveErrors: false, showNumbers: true, reveal: 0, showSolution: false
  };
}
