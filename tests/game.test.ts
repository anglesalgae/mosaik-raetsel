import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { nextHint } from '../src/core/hints';
import { parsePuzzleObject } from '../src/core/parser';
import { buildModel, solve } from '../src/core/solver';
import { Cell } from '../src/core/types';
import { TEMPLATE_PUZZLE } from '../src/data/examples';

function newGame() {
  const g = new Game();
  const parsed = parsePuzzleObject(TEMPLATE_PUZZLE);
  g.load(parsed);
  g.applySolveOutcome(solve(buildModel(5, 5, parsed.puzzle.clues)));
  return g;
}

describe('Game', () => {
  it('macht Züge rückgängig und wiederholt sie', () => {
    const g = newGame();
    g.set([0, 1], Cell.Filled);
    expect(g.cells[1]).toBe(Cell.Filled);
    g.undo();
    expect(g.cells[1]).toBe(Cell.Unknown);
    g.redo();
    expect(g.cells[0]).toBe(Cell.Filled);
  });

  it('meldet „gelöst“, wenn die Lösung eingetragen ist', () => {
    const g = newGame();
    let solved = false;
    g.on('solved', () => { solved = true; });
    g.fillSolution();
    expect(g.solved).toBe(true);
    expect(solved).toBe(true);
  });

  it('löst das Rätsel allein mit Hinweisen', () => {
    const g = newGame();
    for (let k = 0; k < 100 && !g.solved; k++) {
      const h = nextHint(g);
      expect(h.kind).toBe('step');
      if (h.kind === 'step') g.set(h.cells, h.value);
    }
    expect(g.solved).toBe(true);
  });

  it('zeigt Fehler vor weiteren Hinweisen', () => {
    const g = newGame();
    g.set([0], Cell.Filled); // laut Lösung leer
    expect(nextHint(g)).toMatchObject({ kind: 'mistakes', cells: [0] });
  });
});
