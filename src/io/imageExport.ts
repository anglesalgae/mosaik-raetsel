import type { GeneratorLevel } from '../core/generator';
import { fileNameFor } from '../core/serializer';
import { Cell, type Puzzle } from '../core/types';
import { downloadBlob } from './files';

/**
 * Export von Aufgabe und Lösung als Bild (z. B. zum Drucken).
 * Verwendet feste, druckfreundliche Farben – unabhängig vom Hell/Dunkel-Modus.
 */
export type ExportKind = 'puzzle' | 'solution';

const COLORS = {
  background: '#FFFFFF',
  ink: '#1B2540',
  muted: '#5B677E',
  line: '#B9C2CE',
  lineStrong: '#1B2540',
  filled: '#1B2540',
  onFilled: '#FFFFFF'
};

const FONT = '"Atkinson Hyperlegible", "Segoe UI", Arial, sans-serif';

export interface ExportLayout {
  cell: number;
  margin: number;
  titleSize: number;
  /** Schriftgröße für Größe und Stufe rechts in der Titelzeile. */
  infoSize: number;
  header: number;
  gridWidth: number;
  gridHeight: number;
  width: number;
  height: number;
}

/** Größen so wählen, dass das Raster etwa 1800 px groß wird (druckfähig auf A4) und Zahlen lesbar bleiben. */
export function exportLayout(cols: number, rows: number): ExportLayout {
  const cell = Math.max(18, Math.min(120, Math.floor(1800 / Math.max(cols, rows))));
  const margin = Math.max(40, Math.min(120, Math.round(cell * 1.1)));
  const titleSize = Math.max(28, Math.min(84, Math.round(cell * 0.8)));
  const infoSize = Math.round(titleSize * 0.75);
  const header = Math.round(titleSize * 1.3 + margin * 0.5);
  const gridWidth = cols * cell, gridHeight = rows * cell;
  return {
    cell, margin, titleSize, infoSize, header, gridWidth, gridHeight,
    width: Math.max(gridWidth + 2 * margin, 640),
    height: gridHeight + header + 2 * margin
  };
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

/**
 * Raute als Symbol für die Schwierigkeit:
 * leer = Normal, linke Hälfte gefüllt (senkrecht geteilt) = Fortgeschritten, ganz gefüllt = Knifflig.
 */
export function drawDifficultyDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number,
  level: GeneratorLevel, color = COLORS.ink): void {
  const r = size / 2;
  const path = new Path2D();
  path.moveTo(cx, cy - r);
  path.lineTo(cx + r, cy);
  path.lineTo(cx, cy + r);
  path.lineTo(cx - r, cy);
  path.closePath();
  ctx.save();
  ctx.fillStyle = color;
  if (level === 'medium') ctx.fill(path);
  else if (level === 'moderate') {
    ctx.save();
    ctx.clip(path);
    ctx.fillRect(cx - r, cy - r, r, size); // linke Hälfte, senkrecht geteilt
    ctx.restore();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size / 9);
  ctx.lineJoin = 'miter';
  ctx.stroke(path);
  ctx.restore();
}

/** Zeichnet Aufgabe oder Lösung auf ein neues Canvas. */
export function renderPuzzleImage(puzzle: Puzzle, solution: Uint8Array | null, kind: ExportKind,
  difficulty: GeneratorLevel | null = null): HTMLCanvasElement {
  if (kind === 'solution' && !solution) throw new Error('Für dieses Rätsel ist keine Lösung bekannt.');
  const { width: cols, height: rows, clues } = puzzle;
  const L = exportLayout(cols, rows);
  const canvas = document.createElement('canvas');
  canvas.width = L.width;
  canvas.height = L.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D wird nicht unterstützt.');

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, L.width, L.height);

  // Titelzeile: links der Titel, rechts die Größe und die Schwierigkeits-Raute
  const baseline = L.margin + L.titleSize;
  const right = L.width - L.margin;
  const diamond = Math.round(L.infoSize * 1.05);
  const gap = Math.round(L.infoSize * 0.6);
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${L.infoSize}px ${FONT}`;
  const sizeText = `${cols} × ${rows}`;
  const sizeWidth = ctx.measureText(sizeText).width;
  const sizeRight = difficulty ? right - diamond - gap : right;
  ctx.fillStyle = COLORS.muted;
  ctx.textAlign = 'right';
  ctx.fillText(sizeText, sizeRight, baseline);
  if (difficulty) drawDifficultyDiamond(ctx, right - diamond / 2, baseline - L.infoSize * 0.36, diamond, difficulty);

  const infoWidth = sizeWidth + (difficulty ? gap + diamond : 0);
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.ink;
  ctx.font = `700 ${L.titleSize}px ${FONT}`;
  ctx.fillText(fitText(ctx, puzzle.title, right - L.margin - infoWidth - L.infoSize * 1.5), L.margin, baseline);

  const ox = Math.round((L.width - L.gridWidth) / 2);
  const oy = L.margin + L.header;
  const cs = L.cell;

  // Gefüllte Felder (nur Lösung)
  if (kind === 'solution' && solution) {
    ctx.fillStyle = COLORS.filled;
    for (let i = 0; i < solution.length; i++) {
      if (solution[i] === Cell.Filled) ctx.fillRect(ox + (i % cols) * cs, oy + Math.floor(i / cols) * cs, cs, cs);
    }
  }

  // Gitter: dünne Linien, jede fünfte kräftig, dicker Rahmen
  const thin = Math.max(1, Math.round(cs / 28));
  const thick = Math.max(2, Math.round(cs / 12));
  ctx.fillStyle = COLORS.line;
  for (let x = 1; x < cols; x++) if (x % 5) ctx.fillRect(ox + x * cs - thin / 2, oy, thin, L.gridHeight);
  for (let y = 1; y < rows; y++) if (y % 5) ctx.fillRect(ox, oy + y * cs - thin / 2, L.gridWidth, thin);
  ctx.fillStyle = COLORS.lineStrong;
  for (let x = 5; x < cols; x += 5) ctx.fillRect(ox + x * cs - thick / 2, oy, thick, L.gridHeight);
  for (let y = 5; y < rows; y += 5) ctx.fillRect(ox, oy + y * cs - thick / 2, L.gridWidth, thick);
  const border = thick + 1;
  ctx.fillRect(ox - border, oy - border, L.gridWidth + 2 * border, border);
  ctx.fillRect(ox - border, oy + L.gridHeight, L.gridWidth + 2 * border, border);
  ctx.fillRect(ox - border, oy, border, L.gridHeight);
  ctx.fillRect(ox + L.gridWidth, oy, border, L.gridHeight);

  // Zahlen
  ctx.font = `700 ${Math.round(cs * 0.6)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < clues.length; i++) {
    if (clues[i] < 0) continue;
    const filled = kind === 'solution' && solution?.[i] === Cell.Filled;
    ctx.fillStyle = filled ? COLORS.onFilled : COLORS.ink;
    ctx.fillText(String(clues[i]), ox + (i % cols) * cs + cs / 2, oy + Math.floor(i / cols) * cs + cs / 2 + cs * 0.03);
  }
  return canvas;
}

export function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Das Bild konnte nicht erzeugt werden.'))), 'image/jpeg', quality));
}

/** Sorgt dafür, dass die Schrift geladen ist, bevor gezeichnet wird. */
export async function ensureExportFont(): Promise<void> {
  try {
    await document.fonts?.load(`700 32px "Atkinson Hyperlegible"`);
  } catch { /* Ersatzschrift wird verwendet */ }
}

/** Kurzform der Stufe für Dateinamen: 00 = Normal, 05 = Fortgeschritten, 10 = Knifflig. */
export const LEVEL_CODES: Record<GeneratorLevel, string> = { easy: '00', moderate: '05', medium: '10' };

/** Dateinamen für Aufgabe und Lösung, z. B. „kleckse-2507-05-aufgabe.jpg“. */
export function exportFileNames(title: string, difficulty: GeneratorLevel | null): { puzzle: string; solution: string } {
  const code = difficulty ? `-${LEVEL_CODES[difficulty]}` : '';
  return {
    puzzle: fileNameFor(title, `${code}-aufgabe`, 'jpg'),
    solution: fileNameFor(title, `${code}-loesung`, 'jpg')
  };
}

/**
 * Speichert Aufgabe und (falls bekannt) Lösung als zwei JPG-Dateien.
 * Gibt die Dateinamen zurück.
 */
export async function downloadPuzzleImages(puzzle: Puzzle, solution: Uint8Array | null,
  difficulty: GeneratorLevel | null): Promise<string[]> {
  await ensureExportFont();
  const names: string[] = [];
  // Stufe im Dateinamen, damit dasselbe Motiv in mehreren Stufen gespeichert werden kann
  const fileNames = exportFileNames(puzzle.title, difficulty);
  const puzzleName = fileNames.puzzle;
  downloadBlob(puzzleName, await canvasToJpeg(renderPuzzleImage(puzzle, null, 'puzzle', difficulty)));
  names.push(puzzleName);
  if (solution) {
    // Kurze Pause, damit der Browser beide Downloads annimmt
    await new Promise(r => setTimeout(r, 400));
    const solutionName = fileNames.solution;
    downloadBlob(solutionName, await canvasToJpeg(renderPuzzleImage(puzzle, solution, 'solution', difficulty)));
    names.push(solutionName);
  }
  return names;
}
