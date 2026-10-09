import { describe, expect, it } from 'vitest';
import { exportFileNames, exportLayout } from '../src/io/imageExport';

describe('Bild-Export', () => {
  it('wählt lesbare Feldgrößen', () => {
    expect(exportLayout(15, 15).cell).toBe(120);
    expect(exportLayout(80, 80).cell).toBe(22);
    expect(exportLayout(200, 10).cell).toBe(18);
  });

  it('lässt Platz für Rand und Titel', () => {
    const L = exportLayout(20, 10);
    expect(L.width).toBeGreaterThanOrEqual(L.gridWidth + 2 * L.margin);
    expect(L.height).toBe(L.gridHeight + L.header + 2 * L.margin);
  });

  it('hängt die Stufe als Kurzform an die Dateinamen', () => {
    expect(exportFileNames('Kleckse 2507', 'easy')).toEqual({
      puzzle: 'kleckse-2507-00-aufgabe.jpg', solution: 'kleckse-2507-00-loesung.jpg'
    });
    expect(exportFileNames('Kleckse 2507', 'moderate').puzzle).toBe('kleckse-2507-05-aufgabe.jpg');
    expect(exportFileNames('Kleckse 2507', 'medium').solution).toBe('kleckse-2507-10-loesung.jpg');
    expect(exportFileNames('Kleckse 2507', null).puzzle).toBe('kleckse-2507-aufgabe.jpg');
  });
});
