import { Cell, type CellState, type DecidedState, type ParsedFile } from './types';

export const MAX_SIZE = 200;

/** Fehler im Dateiinhalt, mit einer für Nutzer verständlichen Meldung. */
export class FormatError extends Error {
  override name = 'FormatError';
}

const where = (name: string, r: number, c: number) => `in „${name}“, Zeile ${r + 1}, Spalte ${c + 1}`;

/** Zerlegt eine Zeile in Einträge: Zeichen pro Feld oder durch Leerzeichen/Komma getrennt. */
function splitRow(row: unknown, width: number): unknown[] | null {
  if (Array.isArray(row)) return row;
  if (typeof row !== 'string') return null;
  if (width && row.length === width) return [...row];
  const trimmed = row.trim();
  if (/[\s,;]/.test(trimmed)) return trimmed.split(/[\s,;]+/);
  return [...row];
}

function parseGrid<T>(rows: unknown, name: string, width: number, height: number,
  cell: (v: unknown, r: number, c: number) => T): T[] {
  if (!Array.isArray(rows)) throw new FormatError(`„${name}“ muss ein Array von Zeilen sein.`);
  if (rows.length !== height) throw new FormatError(`„${name}“ hat ${rows.length} Zeilen, erwartet werden ${height}.`);
  const out: T[] = [];
  rows.forEach((row, r) => {
    const cells = splitRow(row, width);
    if (!cells) throw new FormatError(`„${name}“, Zeile ${r + 1}: Zeichenkette oder Array erwartet.`);
    if (cells.length !== width) {
      throw new FormatError(`„${name}“, Zeile ${r + 1} hat ${cells.length} Felder, erwartet werden ${width}.`);
    }
    cells.forEach((v, c) => out.push(cell(v, r, c)));
  });
  return out;
}

function parseClue(v: unknown, r: number, c: number): number {
  if (v === null || v === undefined || v === '') return -1;
  if (typeof v === 'number') {
    if (v === -1) return -1;
    if (Number.isInteger(v) && v >= 0 && v <= 9) return v;
    throw new FormatError(`Ungültige Zahl ${v} ${where('clues', r, c)}.`);
  }
  const s = String(v);
  if (s.length !== 1) throw new FormatError(`Ungültiger Eintrag „${s}“ ${where('clues', r, c)}.`);
  if (s >= '0' && s <= '9') return s.charCodeAt(0) - 48;
  if ('.-_ ?'.includes(s)) return -1;
  throw new FormatError(`Unbekanntes Zeichen „${s}“ ${where('clues', r, c)}.`);
}

function parseSolutionCell(v: unknown, r: number, c: number): DecidedState {
  if (v === true || v === 1 || v === '#' || v === '1') return Cell.Filled;
  if (v === false || v === 0 || v === null || v === '.' || v === '0' || v === ' ' || v === '-' || v === '_') return Cell.Empty;
  throw new FormatError(`Ungültiger Eintrag „${String(v)}“ ${where('solution', r, c)}.`);
}

function parseProgressCell(v: unknown, r: number, c: number): CellState {
  if (v === '#' || v === 1 || v === '1') return Cell.Filled;
  if (v === 'x' || v === 'X' || v === 2 || v === '2') return Cell.Empty;
  if (v === '.' || v === '?' || v === ' ' || v === 0 || v === '0' || v === null) return Cell.Unknown;
  throw new FormatError(`Ungültiger Eintrag „${String(v)}“ ${where('progress.cells', r, c)}.`);
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Liest ein Rätsel (optional mit Spielstand) aus einem bereits geparsten JSON-Wert. */
export function parsePuzzleObject(input: unknown): ParsedFile {
  if (!isObject(input)) throw new FormatError('Die Datei enthält kein JSON-Objekt.');
  let obj = input;
  // Erlaubt auch { "puzzle": {...}, "progress": {...} }
  if (isObject(obj.puzzle) && obj.clues === undefined) obj = { ...obj.puzzle, progress: obj.progress };

  const rows = obj.clues;
  if (!Array.isArray(rows) || rows.length === 0) throw new FormatError('Das Feld „clues“ fehlt oder ist leer.');
  const height = rows.length;
  let width = Number.isInteger(obj.width) ? (obj.width as number) : 0;
  if (!width) width = splitRow(rows[0], 0)?.length ?? 0;
  if (obj.height !== undefined && obj.height !== height) {
    throw new FormatError(`„height“ ist ${String(obj.height)}, aber „clues“ hat ${height} Zeilen.`);
  }
  if (width < 1 || width > MAX_SIZE || height > MAX_SIZE) {
    throw new FormatError(`Die Größe muss zwischen 1 × 1 und ${MAX_SIZE} × ${MAX_SIZE} liegen.`);
  }

  const clues = Int8Array.from(parseGrid(rows, 'clues', width, height, parseClue));
  for (let i = 0; i < clues.length; i++) {
    if (clues[i] < 0) continue;
    const x = i % width, y = Math.floor(i / width);
    const max = (Math.min(x + 1, width - 1) - Math.max(x - 1, 0) + 1) * (Math.min(y + 1, height - 1) - Math.max(y - 1, 0) + 1);
    if (clues[i] > max) {
      throw new FormatError(`Die ${clues[i]} in Zeile ${y + 1}, Spalte ${x + 1} ist größer als ihre Umgebung (${max} Felder).`);
    }
  }

  const solution = obj.solution != null
    ? Uint8Array.from(parseGrid(obj.solution, 'solution', width, height, parseSolutionCell))
    : null;

  let progress: ParsedFile['progress'] = null;
  if (isObject(obj.progress) && obj.progress.cells !== undefined) {
    const cells = Uint8Array.from(parseGrid(obj.progress.cells, 'progress.cells', width, height, parseProgressCell));
    const t = obj.progress.elapsedSeconds;
    progress = { cells, elapsedSeconds: typeof t === 'number' && Number.isFinite(t) ? Math.max(0, Math.floor(t)) : 0 };
  }

  const extra: Record<string, unknown> = {};
  for (const k of ['source', 'description', 'difficulty', 'license']) if (obj[k] !== undefined) extra[k] = obj[k];

  return {
    puzzle: {
      width, height, clues, solution,
      title: typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : 'Ohne Titel',
      author: typeof obj.author === 'string' ? obj.author.trim() : '',
      extra
    },
    progress
  };
}

/** Liest ein Rätsel aus JSON-Text. */
export function parsePuzzleText(text: string): ParsedFile {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (e) {
    throw new FormatError(`Das ist kein gültiges JSON: ${(e as Error).message}`);
  }
  return parsePuzzleObject(value);
}
