import type { Game } from './game';
import { findDeduction } from './solver';
import { Cell, type DecidedState } from './types';

/** Ergebnis einer Hinweis-Anfrage. */
export type Hint =
  | { kind: 'step'; cells: number[]; clues: number[]; value: DecidedState; message: string }
  | { kind: 'mistakes'; cells: number[]; message: string }
  | { kind: 'contradiction'; clues: number[]; message: string }
  | { kind: 'none'; message: string };

export const position = (game: Game, i: number): string =>
  `Zeile ${Math.floor(i / game.width) + 1}, Spalte ${(i % game.width) + 1}`;

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * Sucht den nächsten Hinweis: zuerst Fehler (wenn die Lösung bekannt ist),
 * dann einen logischen Schritt, zuletzt ein aufgedecktes Feld.
 */
export function nextHint(game: Game): Hint {
  if (game.solved) return { kind: 'none', message: 'Das Rätsel ist bereits gelöst.' };

  const wrong = game.wrongCells();
  if (wrong.length) {
    return {
      kind: 'mistakes', cells: wrong,
      message: `${wrong.length === 1 ? 'Ein Feld ist' : `${wrong.length} Felder sind`} falsch gesetzt (rot umrandet). Korrigiere sie zuerst.`
    };
  }

  const clue = (c: number) => game.puzzle.clues[c];
  const d = findDeduction(game.model, game.cells);
  if (d?.kind === 'contradiction') {
    const names = d.clues.map(c => `${clue(c)} (${position(game, c)})`).join(' und ');
    return { kind: 'contradiction', clues: d.clues, message: `Widerspruch bei ${names}: Hier stimmt etwas nicht mehr. Nimm Züge zurück.` };
  }
  if (d) {
    const k = d.cells.length;
    let text: string;
    if (d.rule === 'zero') {
      text = `Die ${clue(d.clues[0])} in ${position(game, d.clues[0])} hat schon alle Felder – ${plural(k, 'das markierte Feld bleibt', `die ${k} markierten Felder bleiben`)} leer.`;
    } else if (d.rule === 'full') {
      text = `Die ${clue(d.clues[0])} in ${position(game, d.clues[0])} braucht noch ${k} ${plural(k, 'Feld', 'Felder')} und hat genau so viele frei – ${plural(k, 'es wird', 'alle werden')} gefüllt.`;
    } else {
      const verb = d.value === Cell.Filled ? 'gefüllt' : 'leer';
      text = `Vergleiche die ${clue(d.clues[0])} und die ${clue(d.clues[1])}: Über ihre gemeinsamen Felder folgt, dass ${plural(k, 'das markierte Feld', `die ${k} markierten Felder`)} ${verb} ${plural(k, 'sein muss', 'sein müssen')}.`;
    }
    return { kind: 'step', cells: d.cells, clues: d.clues, value: d.value, message: `${text} Noch einmal „Hinweis“ wendet es an.` };
  }

  const sol = game.solution;
  if (sol) {
    let i = game.cells.findIndex((v, k) => v === Cell.Unknown && sol[k] === Cell.Filled);
    if (i < 0) i = game.cells.findIndex(v => v === Cell.Unknown);
    if (i >= 0) {
      const value: DecidedState = sol[i] === Cell.Filled ? Cell.Filled : Cell.Empty;
      return {
        kind: 'step', cells: [i], clues: [], value,
        message: `Hier hilft nur Ausprobieren. Tipp: ${position(game, i)} ist ${value === Cell.Filled ? 'gefüllt' : 'leer'}. Noch einmal „Hinweis“ trägt es ein.`
      };
    }
  }
  return { kind: 'none', message: 'Kein Hinweis gefunden.' };
}
