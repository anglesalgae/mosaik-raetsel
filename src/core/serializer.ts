import { Cell, type Puzzle, type SaveFile } from './types';

function rows(width: number, height: number, cell: (i: number) => string): string[] {
  const out: string[] = [];
  for (let y = 0; y < height; y++) {
    let line = '';
    for (let x = 0; x < width; x++) line += cell(y * width + x);
    out.push(line);
  }
  return out;
}

export interface SaveInput {
  puzzle: Puzzle;
  cells?: Uint8Array;
  elapsedSeconds?: number;
  solved?: boolean;
  now?: Date;
}

/** Erzeugt die JSON-Struktur für Rätsel + Spielstand. */
export function toSaveFile({ puzzle, cells, elapsedSeconds = 0, solved = false, now = new Date() }: SaveInput): SaveFile {
  const { width, height } = puzzle;
  const file: SaveFile = { format: 'fill-a-pix', version: 1, title: puzzle.title, width, height, clues: [] };
  if (puzzle.author) file.author = puzzle.author;
  Object.assign(file, puzzle.extra);
  // Reihenfolge der Schlüssel: Metadaten zuerst, dann Gitter
  file.width = width;
  file.height = height;
  file.clues = rows(width, height, i => (puzzle.clues[i] < 0 ? '.' : String(puzzle.clues[i])));
  if (puzzle.solution) {
    const sol = puzzle.solution;
    file.solution = rows(width, height, i => (sol[i] === Cell.Filled ? '#' : '.'));
  }
  if (cells) {
    file.progress = {
      cells: rows(width, height, i => (cells[i] === Cell.Filled ? '#' : cells[i] === Cell.Empty ? 'x' : '.')),
      elapsedSeconds,
      solved,
      savedAt: now.toISOString()
    };
  }
  return file;
}

export function toJson(file: SaveFile): string {
  return JSON.stringify(file, null, 2);
}

/** Dateiname aus dem Titel, z. B. „Segelboot“ → „segelboot-stand.json“. */
export function fileNameFor(title: string, suffix = '-stand', extension = 'json'): string {
  const slug = (title || 'raetsel').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'raetsel';
  return `${slug}${suffix}.${extension}`;
}
