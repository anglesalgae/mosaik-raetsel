import { describe, expect, it } from 'vitest';
import { comparisonBudget, fullClues, generatePuzzle } from '../src/core/generator';
import { buildModel, isLogicSolvable, solve } from '../src/core/solver';

/** Testmotiv: Ring mit Querbalken. */
function motif(w: number, h: number): Uint8Array {
  const p = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x - (w - 1) / 2, dy = y - (h - 1) / 2, r = Math.hypot(dx, dy);
    p[y * w + x] = (r > w * 0.25 && r < w * 0.42) || Math.abs(dy) < 1 ? 1 : 0;
  }
  return p;
}

const asFilled = (sol: Uint8Array) => Array.from(sol, v => (v === 1 ? 1 : 0));

describe('Generator', () => {
  it('berechnet alle Zahlen aus dem Raster', () => {
    const clues = fullClues(3, 3, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    expect(Array.from(clues)).toEqual([2, 2, 1, 2, 3, 2, 1, 2, 2]);
  });

  for (const level of ['easy', 'moderate', 'medium'] as const) {
    it(`erzeugt eindeutige, logisch lösbare Rätsel (${level})`, () => {
      const w = 18, h = 14, p = motif(w, h);
      const res = generatePuzzle(w, h, p, { level, seed: 7 });
      expect(res.quality).toBe('logic');
      expect(res.clueCount).toBeLessThan(w * h * 0.6);
      const m = buildModel(w, h, res.clues);
      expect(isLogicSolvable(m)).toBe(true);
      const s = solve(m);
      expect(s.status).toBe('unique');
      expect(asFilled(s.solution!)).toEqual(Array.from(p));
    });
  }

  it('kommt bei „Normal“ ohne Vergleiche aus', () => {
    const res = generatePuzzle(18, 14, motif(18, 14), { level: 'easy', seed: 3 });
    expect(res.level).toBe('easy');
    expect(res.comparisons).toBe(0);
  });

  it('meldet die tatsächliche Stufe passend zur Zahl der Vergleiche', () => {
    for (const level of ['easy', 'moderate', 'medium'] as const) {
      const res = generatePuzzle(20, 20, motif(20, 20), { level, seed: 4 });
      const expected = res.comparisons === 0 ? 'easy' : res.comparisons <= comparisonBudget(20, 20) ? 'moderate' : 'medium';
      expect(res.level).toBe(expected);
    }
  });

  it('braucht bei „Fortgeschritten“ höchstens wenige Vergleiche', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const res = generatePuzzle(20, 20, motif(20, 20), { level: 'moderate', seed });
      expect(res.quality).toBe('logic');
      expect(res.comparisons).toBeLessThanOrEqual(comparisonBudget(20, 20));
    }
  });

  it('liegt im Schnitt zwischen „Normal“ und „Knifflig“', () => {
    const avg = (level: 'easy' | 'moderate' | 'medium') => {
      let sum = 0;
      for (let seed = 1; seed <= 6; seed++) sum += generatePuzzle(24, 24, motif(24, 24), { level, seed }).comparisons;
      return sum / 6;
    };
    const easy = avg('easy'), moderate = avg('moderate'), hard = avg('medium');
    expect(hard).toBeGreaterThan(comparisonBudget(24, 24));
    expect(easy).toBe(0);
    expect(moderate).toBeGreaterThan(0);
    expect(moderate).toBeLessThan(hard);
  });

  it('begrenzt die Vergleiche abhängig von der Größe', () => {
    expect(comparisonBudget(10, 10)).toBe(2);
    expect(comparisonBudget(20, 20)).toBe(3);
    expect(comparisonBudget(80, 80)).toBe(6);
  });

  it('ist mit gleichem Startwert reproduzierbar', () => {
    const p = motif(12, 12);
    const a = generatePuzzle(12, 12, p, { level: 'easy', seed: 42 });
    const b = generatePuzzle(12, 12, p, { level: 'easy', seed: 42 });
    expect(Array.from(a.clues)).toEqual(Array.from(b.clues));
  });

  it('meldet Fortschritt bis 100 %', () => {
    let last = 0;
    generatePuzzle(10, 10, motif(10, 10), { level: 'easy', onProgress: f => { last = f; } });
    expect(last).toBe(1);
  });
});

describe('Schwierigkeit bestimmen', () => {
  it('erkennt die Stufe erzeugter Rätsel wieder', async () => {
    const { classifyDifficulty } = await import('../src/core/generator');
    for (const level of ['easy', 'moderate', 'medium'] as const) {
      const w = 22, h = 22, p = motif(w, h);
      const res = generatePuzzle(w, h, p, { level, seed: 9 });
      const found = classifyDifficulty(w, h, res.clues);
      expect(found).toBe(res.level);
    }
  });

  it('liefert null für mehrdeutige Rätsel', async () => {
    const { classifyDifficulty } = await import('../src/core/generator');
    expect(classifyDifficulty(3, 3, Int8Array.from([1, -1, -1, -1, -1, -1, -1, -1, -1]))).toBeNull();
  });
});

describe('Vorab-Test der Stufe', () => {
  it('erkennt, ob ein Raster eine Stufe erreichen kann', async () => {
    const { canReachLevel } = await import('../src/core/generator');
    const p = motif(18, 14);
    expect(canReachLevel(18, 14, p, 'medium')).toBe(true);
    // Schachbrett-Ausschnitt ohne eindeutige Lösung erreicht keine Stufe
    expect(canReachLevel(2, 2, [1, 0, 0, 1], 'medium')).toBe(false);
  });
});
