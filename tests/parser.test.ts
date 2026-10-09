import { describe, expect, it } from 'vitest';
import { FormatError, parsePuzzleObject, parsePuzzleText } from '../src/core/parser';
import { fileNameFor, toJson, toSaveFile } from '../src/core/serializer';
import { Cell } from '../src/core/types';
import { TEMPLATE_PUZZLE } from '../src/data/examples';

describe('Parser', () => {
  it('liest Zeichenketten-Zeilen', () => {
    const { puzzle } = parsePuzzleObject({ clues: ['1.', '.3'] });
    expect(puzzle.width).toBe(2);
    expect(Array.from(puzzle.clues)).toEqual([1, -1, -1, 3]);
    expect(puzzle.title).toBe('Ohne Titel');
  });

  it('liest Arrays mit Zahlen und null', () => {
    const { puzzle } = parsePuzzleObject({ clues: [[null, 2], [4, null]] });
    expect(Array.from(puzzle.clues)).toEqual([-1, 2, 4, -1]);
  });

  it('liest durch Leerzeichen getrennte Zeilen', () => {
    const { puzzle } = parsePuzzleObject({ width: 3, clues: ['1 . 2', '. . .'] });
    expect(Array.from(puzzle.clues)).toEqual([1, -1, 2, -1, -1, -1]);
  });

  it('meldet verständliche Fehler', () => {
    expect(() => parsePuzzleObject({ clues: ['12a'] })).toThrow(/Zeile 1, Spalte 3/);
    expect(() => parsePuzzleObject({ clues: ['12', '1'] })).toThrow(/Zeile 2 hat 1 Felder/);
    expect(() => parsePuzzleObject({})).toThrow(FormatError);
    expect(() => parsePuzzleObject({ clues: ['9.', '..'] })).toThrow(/größer als ihre Umgebung/);
    expect(() => parsePuzzleText('{kaputt')).toThrow(/kein gültiges JSON/);
  });

  it('übersteht Speichern und Laden mit Spielstand', () => {
    const { puzzle } = parsePuzzleObject(TEMPLATE_PUZZLE);
    const cells = new Uint8Array(25);
    cells[0] = Cell.Empty; cells[1] = Cell.Filled;
    const json = toJson(toSaveFile({ puzzle, cells, elapsedSeconds: 42 }));
    const again = parsePuzzleText(json);
    expect(Array.from(again.puzzle.clues)).toEqual(Array.from(puzzle.clues));
    expect(Array.from(again.puzzle.solution!)).toEqual(Array.from(puzzle.solution!));
    expect(Array.from(again.progress!.cells)).toEqual(Array.from(cells));
    expect(again.progress!.elapsedSeconds).toBe(42);
  });

  it('bildet Dateinamen aus dem Titel', () => {
    expect(fileNameFor('Große Brücke!')).toBe('grosse-bruecke-stand.json');
  });
});

describe('Export-Hilfen', () => {
  it('bildet JPG-Dateinamen', () => {
    expect(fileNameFor('Segelboot', '-aufgabe', 'jpg')).toBe('segelboot-aufgabe.jpg');
    expect(fileNameFor('Segelboot', '-loesung', 'jpg')).toBe('segelboot-loesung.jpg');
  });
});
