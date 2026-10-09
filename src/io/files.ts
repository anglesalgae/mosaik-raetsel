import { FormatError, parsePuzzleText } from '../core/parser';
import type { ParsedFile } from '../core/types';

const MAX_FILE_BYTES = 5_000_000;

/** Liest eine vom Nutzer gewählte JSON-Datei als Rätsel. */
export async function readPuzzleFile(file: File): Promise<ParsedFile> {
  if (file.size > MAX_FILE_BYTES) throw new FormatError('Die Datei ist größer als 5 MB.');
  return parsePuzzleText(await file.text());
}

/** Bietet Text als Datei zum Herunterladen an. */
export function downloadText(fileName: string, text: string, mime = 'application/json'): void {
  downloadBlob(fileName, new Blob([text], { type: mime }));
}

/** Bietet beliebige Daten als Datei zum Herunterladen an. */
export function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
}

/** Kopiert Text in die Zwischenablage; false, wenn das nicht möglich ist. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
