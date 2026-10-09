import { describe, expect, it } from 'vitest';
import { GeneratorClient } from '../src/core/generatorClient';
import { createRandomPuzzle } from '../src/core/puzzleFactory';

describe('Zufallsrätsel', () => {
  for (const level of ['easy', 'moderate', 'medium'] as const) {
    it(`hält die Stufe „${level}“ ein`, async () => {
      const client = new GeneratorClient(); // ohne Worker-Unterstützung läuft der Generator direkt
      for (const seed of [11, 22, 33, 44]) {
        const { result, parsed } = await createRandomPuzzle(client, { width: 16, height: 16, level, kind: 'any', seed });
        expect(result.quality).toBe('logic');
        expect(result.level).toBe(level);
        expect(parsed.puzzle.extra.difficulty).toBe(level);
        expect(parsed.puzzle.solution).not.toBeNull();
      }
    }, 60000);
  }
});

describe('Zufallsrätsel mit Labyrinth', () => {
  for (const level of ['easy', 'moderate'] as const) {
    it(`findet Labyrinthe der Stufe „${level}“`, async () => {
      const client = new GeneratorClient();
      for (const seed of [5, 6, 7]) {
        const { result } = await createRandomPuzzle(client, { width: 20, height: 20, level, kind: 'maze', seed });
        expect(result.level).toBe(level);
      }
    }, 60000);
  }
});

describe('Stufe einhalten bei festem Motiv', () => {
  it('versucht bei zu leichtem Ergebnis weitere Verteilungen', async () => {
    const { generateForLevel } = await import('../src/core/puzzleFactory');
    const { generateMotif } = await import('../src/core/motifs');
    const client = new GeneratorClient();
    let hits = 0, total = 0;
    for (let s = 0; s < 12; s++) {
      const m = generateMotif('blobs', 20, 20, s * 977 + 5);
      const r = await generateForLevel(client, 20, 20, m.pattern, 'medium');
      if (r.quality !== 'logic') continue;
      total++;
      if (r.level === 'medium') hits++;
    }
    expect(hits).toBe(total);
  }, 60000);
});
