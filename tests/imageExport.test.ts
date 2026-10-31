import { describe, expect, it } from 'vitest';
import { isDeadly } from '../src/core/generator';
import { EXPORT_CELL, exportFileNames, exportLayout } from '../src/io/imageExport';

describe('Bild-Export', () => {
  it('verwendet für alle Rastergrößen dieselbe Feldgröße', () => {
    expect(exportLayout(15, 15).cell).toBe(EXPORT_CELL);
    expect(exportLayout(80, 80).cell).toBe(EXPORT_CELL);
    expect(exportLayout(200, 10).cell).toBe(EXPORT_CELL);
  });

  it('lässt das Raster proportional zu Zeilen und Spalten wachsen', () => {
    const small = exportLayout(20, 10), big = exportLayout(40, 30);
    expect(big.gridWidth - small.gridWidth).toBe(20 * EXPORT_CELL);
    expect(big.height - small.height).toBe(20 * EXPORT_CELL);
  });

  it('lässt Platz für Rand und Titel', () => {
    const L = exportLayout(20, 10);
    expect(L.width).toBeGreaterThanOrEqual(L.gridWidth + 2 * L.margin);
    expect(L.height).toBe(L.gridHeight + L.header + 2 * L.margin);
  });

  it('zeigt den Totenschädel erst bei mehr Vergleichen als einem Viertel der Zahlen', () => {
    expect(isDeadly(0, 40)).toBe(false);
    expect(isDeadly(10, 40)).toBe(false);
    expect(isDeadly(11, 40)).toBe(true);
  });

  it('hängt die Stufe als Kurzform an die Dateinamen', () => {
    expect(exportFileNames('Kleckse 2507', 'easy')).toEqual({
      puzzle: 'kleckse-2507-00-aufgabe.jpg', solution: 'kleckse-2507-00-loesung.jpg', json: 'kleckse-2507-00.json'
    });
    expect(exportFileNames('Kleckse 2507', null).json).toBe('kleckse-2507.json');
    expect(exportFileNames('Kleckse 2507', 'moderate').puzzle).toBe('kleckse-2507-05-aufgabe.jpg');
    expect(exportFileNames('Kleckse 2507', 'medium').solution).toBe('kleckse-2507-10-loesung.jpg');
    expect(exportFileNames('Kleckse 2507', null).puzzle).toBe('kleckse-2507-aufgabe.jpg');
  });
});
