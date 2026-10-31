import { isDeadly, type GeneratorLevel } from '../core/generator';
import { fileNameFor, toJson, toSaveFile } from '../core/serializer';
import { Cell, type Puzzle } from '../core/types';
import { downloadBlob, downloadText } from './files';

/**
 * Export von Aufgabe und Lösung als Bild (z. B. zum Drucken).
 * Verwendet feste, druckfreundliche Farben – unabhängig vom Hell/Dunkel-Modus.
 */
export type ExportKind = 'puzzle' | 'solution';

/** Stufe und Zahl der nötigen Vergleiche für die Titelzeile. */
export interface ExportDifficulty {
  level: GeneratorLevel;
  comparisons: number;
}

const COLORS = {
  background: '#FFFFFF',
  ink: '#1B2540',
  muted: '#5B677E',
  line: '#7F8A9C',
  lineStrong: '#1B2540',
  filled: '#1B2540',
  onFilled: '#FFFFFF'
};

/** Seitenfaktor der Bildausgabe: halbe Breite und Höhe = ein Viertel der Pixel. */
const EXPORT_SCALE = 0.5;

const FONT = '"Atkinson Hyperlegible", "Segoe UI", Arial, sans-serif';
/** Schrift für die Zahlen im Raster – klare Ziffern, auch bei kleiner Auflösung gut lesbar. */
const CLUE_FONT = 'Arial, "Helvetica Neue", Helvetica, sans-serif';

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

/** Feste Kästchengröße im Layout-Maßstab – ausgegeben wird sie mit EXPORT_SCALE (also 30 px). */
export const EXPORT_CELL = 60;

/**
 * Feste Kästchengröße für alle Rastergrößen: Die Bildgröße wächst mit der Zahl der Zeilen und Spalten,
 * sodass alle Bilder mit demselben Maßstab vergrößert oder verkleinert werden können.
 */
export function exportLayout(cols: number, rows: number): ExportLayout {
  const cell = EXPORT_CELL;
  // Nur ein schmaler weißer Rand rings um Titel und Raster (etwas breiter als der Rasterrahmen)
  const margin = Math.round(cell * 0.2);
  const titleSize = Math.round(cell * 0.8);
  const infoSize = Math.round(titleSize * 0.75);
  const header = Math.round(titleSize * 1.5);
  const gridWidth = cols * cell, gridHeight = rows * cell;
  return {
    cell, margin, titleSize, infoSize, header, gridWidth, gridHeight,
    width: gridWidth + 2 * margin,
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

/** Symbol für Vergleiche: zwei überlappende Kreise, die gemeinsame Fläche gefüllt. */
export function drawComparisonIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number,
  color = COLORS.ink): void {
  // Stark überlappend, damit das Symbol nicht breiter wird als die Raute
  const r = size * 0.36;
  const dx = r * 0.4;
  const left = new Path2D(), right = new Path2D();
  left.arc(cx - dx, cy, r, 0, Math.PI * 2);
  right.arc(cx + dx, cy, r, 0, Math.PI * 2);
  ctx.save();
  ctx.fillStyle = color;
  ctx.save();
  ctx.clip(left);
  ctx.fill(right);
  ctx.restore();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size / 11);
  ctx.stroke(left);
  ctx.stroke(right);
  ctx.restore();
}

/** Totenschädel für besonders schwere Rätsel (siehe isDeadly). */
export function drawSkull(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number,
  color = COLORS.ink): void {
  const s = size;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.1, s * 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - s * 0.22, cy + s * 0.1, s * 0.44, s * 0.36);
  // Augen, Nase und Zähne ausgespart
  ctx.fillStyle = COLORS.background;
  for (const ex of [-0.15, 0.15]) {
    ctx.beginPath();
    ctx.arc(cx + s * ex, cy - s * 0.06, s * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.04);
  ctx.lineTo(cx + s * 0.06, cy + s * 0.16);
  ctx.lineTo(cx - s * 0.06, cy + s * 0.16);
  ctx.closePath();
  ctx.fill();
  for (const tx of [-0.11, 0, 0.11]) ctx.fillRect(cx + s * tx - s * 0.02, cy + s * 0.3, s * 0.04, s * 0.16);
  ctx.restore();
}

/** Zeichnet Aufgabe oder Lösung auf ein neues Canvas. */
export function renderPuzzleImage(puzzle: Puzzle, solution: Uint8Array | null, kind: ExportKind,
  difficulty: ExportDifficulty | null = null): HTMLCanvasElement {
  if (kind === 'solution' && !solution) throw new Error('Für dieses Rätsel ist keine Lösung bekannt.');
  const { width: cols, height: rows, clues } = puzzle;
  const L = exportLayout(cols, rows);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(L.width * EXPORT_SCALE);
  canvas.height = Math.round(L.height * EXPORT_SCALE);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D wird nicht unterstützt.');
  // Gezeichnet wird weiter im Layout-Maßstab, ausgegeben in verringerter Auflösung
  ctx.scale(canvas.width / L.width, canvas.height / L.height);

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, L.width, L.height);

  // Titelzeile: links der Titel, rechts die Größe, die Zahl der Vergleiche und die Stufe
  // (Raute bzw. Totenschädel) – von rechts nach links gesetzt
  const baseline = L.margin + L.titleSize;
  const right = L.width - L.margin;
  const icon = Math.round(L.infoSize * 1.05);
  const iconY = baseline - L.infoSize * 0.36;
  const gap = Math.round(L.infoSize * 0.6);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'right';
  ctx.font = `700 ${L.infoSize}px ${FONT}`;
  let x = right;
  if (difficulty) {
    const clueCount = clues.reduce((n, c) => n + (c >= 0 ? 1 : 0), 0);
    if (isDeadly(difficulty.comparisons, clueCount)) drawSkull(ctx, x - icon / 2, iconY, icon);
    else drawDifficultyDiamond(ctx, x - icon / 2, iconY, icon, difficulty.level);
    x -= icon + gap;
    if (difficulty.comparisons > 0) {
      const count = String(difficulty.comparisons);
      ctx.fillStyle = COLORS.muted;
      ctx.fillText(count, x, baseline);
      x -= ctx.measureText(count).width + Math.round(gap * 0.3);
      const venn = icon;
      drawComparisonIcon(ctx, x - venn / 2, iconY, venn, COLORS.muted);
      x -= venn + gap;
    }
  }
  const sizeText = `${cols} × ${rows}`;
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(sizeText, x, baseline);
  x -= ctx.measureText(sizeText).width;

  const infoWidth = right - x;
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.ink;
  ctx.font = `700 ${L.titleSize}px ${FONT}`;
  ctx.fillText(fitText(ctx, puzzle.title, right - L.margin - infoWidth - L.infoSize * 0.8), L.margin, baseline);

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
  const thin = Math.max(2, Math.round(cs / 20));
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
  ctx.font = `700 ${Math.round(cs * 0.72)}px ${CLUE_FONT}`;
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

/** Dateinamen für Aufgabe, Lösung und JSON, z. B. „kleckse-2507-05-aufgabe.jpg“ und „kleckse-2507-05.json“. */
export function exportFileNames(title: string, difficulty: GeneratorLevel | null): { puzzle: string; solution: string; json: string } {
  const code = difficulty ? `-${LEVEL_CODES[difficulty]}` : '';
  return {
    puzzle: fileNameFor(title, `${code}-aufgabe`, 'jpg'),
    solution: fileNameFor(title, `${code}-loesung`, 'jpg'),
    json: fileNameFor(title, code, 'json')
  };
}

/**
 * Speichert Aufgabe und (falls bekannt) Lösung als zwei JPG-Dateien, dazu das Rätsel als JSON.
 * Gibt die Dateinamen zurück.
 */
export async function downloadPuzzleImages(puzzle: Puzzle, solution: Uint8Array | null,
  difficulty: ExportDifficulty | null): Promise<string[]> {
  await ensureExportFont();
  const names: string[] = [];
  // Stufe im Dateinamen, damit dasselbe Motiv in mehreren Stufen gespeichert werden kann
  const fileNames = exportFileNames(puzzle.title, difficulty?.level ?? null);
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
  // Dazu das Rätsel mit Lösung als JSON, damit es sich später wieder laden lässt
  await new Promise(r => setTimeout(r, 400));
  downloadText(fileNames.json, toJson(toSaveFile({ puzzle })));
  names.push(fileNames.json);
  return names;
}
