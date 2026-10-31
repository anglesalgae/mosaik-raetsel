import { describe, expect, it } from 'vitest';
import { containRect, fillRatio, otsuThreshold, smoothPattern, toPattern } from '../src/image/pattern';

describe('Bildraster', () => {
  it('findet eine Schwelle zwischen zwei Helligkeitsgruppen', () => {
    const lum = [...Array(50).fill(30), ...Array(50).fill(220)];
    const t = otsuThreshold(lum);
    expect(t).toBeGreaterThan(30);
    expect(t).toBeLessThan(220);
  });

  it('füllt dunkle Felder, invertiert auf Wunsch', () => {
    expect(Array.from(toPattern([10, 200, 90], 100, false))).toEqual([1, 0, 1]);
    expect(Array.from(toPattern([10, 200, 90], 100, true))).toEqual([0, 1, 0]);
  });

  it('entfernt einzelne Ausreißer', () => {
    const lone = new Uint8Array(9); lone[4] = 1;
    expect(fillRatio(smoothPattern(lone, 3, 3))).toBe(0);
    const hole = new Uint8Array(9).fill(1); hole[4] = 0;
    expect(Array.from(smoothPattern(hole, 3, 3))).toEqual(Array(9).fill(1));
  });

  it('setzt das Bild unverzerrt und mittig in das quadratische Raster', () => {
    expect(containRect(800, 600, 40, 40)).toEqual({ x: 0, y: 5, w: 40, h: 30 });
    expect(containRect(100, 200, 40, 40)).toEqual({ x: 10, y: 0, w: 20, h: 40 });
    expect(containRect(500, 500, 40, 40)).toEqual({ x: 0, y: 0, w: 40, h: 40 });
  });
});
