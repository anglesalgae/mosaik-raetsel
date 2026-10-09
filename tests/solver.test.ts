import { describe, expect, it } from 'vitest';
import { parsePuzzleObject } from '../src/core/parser';
import { buildModel, findDeduction, isLogicSolvable, satisfies, solve } from '../src/core/solver';
import { Cell } from '../src/core/types';
import { EXAMPLE_PUZZLE, TEMPLATE_PUZZLE } from '../src/data/examples';

const modelOf = (file: unknown) => {
  const { puzzle } = parsePuzzleObject(file);
  return { puzzle, model: buildModel(puzzle.width, puzzle.height, puzzle.clues) };
};

describe('Löser', () => {
  it('löst das Beispielrätsel eindeutig und ohne Raten', () => {
    const { model } = modelOf(EXAMPLE_PUZZLE);
    const res = solve(model);
    expect(res.status).toBe('unique');
    expect(res.logicSolvable).toBe(true);
    expect(isLogicSolvable(model)).toBe(true);
    expect(satisfies(model, res.solution!)).toBe(true);
  });

  it('findet dieselbe Lösung wie die Vorlage', () => {
    const { puzzle, model } = modelOf(TEMPLATE_PUZZLE);
    const res = solve(model);
    expect(res.status).toBe('unique');
    expect(Array.from(res.solution!)).toEqual(Array.from(puzzle.solution!));
  });

  it('erkennt widersprüchliche Zahlen', () => {
    const { model } = modelOf({ clues: ['0.', '.4'] });
    expect(solve(model).status).toBe('none');
  });

  it('erkennt mehrdeutige Rätsel', () => {
    const { model } = modelOf({ clues: ['1..', '...', '...'] });
    expect(solve(model).status).toBe('multiple');
  });

  it('liefert einen einfachen Schritt bei einer 0', () => {
    const { model } = modelOf({ clues: ['0..', '...', '...'] });
    const d = findDeduction(model, new Uint8Array(9));
    expect(d).toMatchObject({ kind: 'deduction', rule: 'zero', value: Cell.Empty });
    if (d?.kind === 'deduction') expect(d.cells.sort()).toEqual([0, 1, 3, 4]);
  });

  it('meldet einen Widerspruch im Spielstand', () => {
    const { model } = modelOf({ clues: ['1..', '...', '...'] });
    const st = new Uint8Array(9);
    st[0] = Cell.Filled; st[1] = Cell.Filled;
    expect(findDeduction(model, st)).toMatchObject({ kind: 'contradiction', clues: [0] });
  });
});
