import { describe, expect, it } from 'vitest';
import { generatePuzzle } from '../src/core/generator';
import { MOTIF_KINDS, generateMotif } from '../src/core/motifs';
import { buildModel, solve } from '../src/core/solver';

const fill = (p: Uint8Array) => p.reduce((s, v) => s + v, 0) / p.length;

describe('Motive', () => {
  for (const { kind } of MOTIF_KINDS) {
    it(`erzeugt „${kind}“ als lösbares Rätsel`, () => {
      for (const [w, h] of [[15, 15], [24, 18]] as const) {
        for (const seed of [1, 2, 3]) {
          const m = generateMotif(kind, w, h, seed * 1000);
          expect(m.kind).toBe(kind);
          expect(m.pattern.length).toBe(w * h);
          const f = fill(m.pattern);
          expect(f).toBeGreaterThan(0.1);
          expect(f).toBeLessThan(kind === 'maze' ? 0.92 : 0.85);
          const res = generatePuzzle(w, h, m.pattern, { level: 'easy', seed: 1 });
          if (res.quality !== 'ambiguous') {
            const s = solve(buildModel(w, h, res.clues));
            expect(s.status).toBe('unique');
          }
        }
      }
    });
  }

  it('schreibt eigenen Text in Blockschrift', () => {
    const a = generateMotif('letters', 30, 30, 5, { text: 'Anna' });
    const b = generateMotif('letters', 30, 30, 9, { text: 'Anna' });
    const c = generateMotif('letters', 30, 30, 5, { text: 'Otto' });
    expect(a.kind).toBe('letters');
    expect(fill(a.pattern)).toBeGreaterThan(0.1);
    // Gleicher Text ergibt dieselben Buchstaben (nur der Rahmen kann sich unterscheiden)
    const inner = (p: Uint8Array) => Array.from(p).filter((_, i) => i % 30 > 0 && i % 30 < 29 && i >= 30 && i < 870);
    expect(inner(a.pattern)).toEqual(inner(b.pattern));
    expect(inner(a.pattern)).not.toEqual(inner(c.pattern));
  });

  it('ist reproduzierbar', () => {
    const a = generateMotif('any', 20, 20, 77), b = generateMotif('any', 20, 20, 77);
    expect(a.kind).toBe(b.kind);
    expect(Array.from(a.pattern)).toEqual(Array.from(b.pattern));
  });

  it('wählt bei „any“ verschiedene Arten', () => {
    const kinds = new Set(Array.from({ length: 30 }, (_, i) => generateMotif('any', 16, 16, i * 31).kind));
    expect(kinds.size).toBeGreaterThan(3);
  });
});
