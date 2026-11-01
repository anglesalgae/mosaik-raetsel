import { canReachLevel, compareLevels, type GenerateResult, type GeneratorLevel } from './generator';
import type { GeneratorClient } from './generatorClient';
import { generateMotif, motifLabel, type MotifKind } from './motifs';
import { newSeed } from './random';
import { Cell, type ParsedFile } from './types';

export interface CreatedPuzzle {
  parsed: ParsedFile;
  result: GenerateResult;
  /** Optionaler Hinweis für die Statusmeldung (z. B. Motiv wurde gewechselt). */
  note?: string;
}

/**
 * Erzeugt Zahlen für ein Raster und versucht bei Bedarf weitere Reihenfolgen,
 * falls das Ergebnis leichter ausfällt als gewünscht (z. B. „Knifflig“ mit zu wenigen Vergleichen).
 * Zu schwere Ergebnisse lassen sich so nicht beheben – dafür braucht es ein anderes Motiv.
 */
export async function generateForLevel(client: GeneratorClient, width: number, height: number,
  pattern: Uint8Array, level: GeneratorLevel, onProgress?: (fraction: number) => void): Promise<GenerateResult> {
  const attempts = width * height > 2500 ? 3 : 8;
  let result: GenerateResult | null = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    result = await client.run({
      width, height, pattern, level,
      onProgress: f => onProgress?.(attempt === 1 ? f : 1)
    });
    if (result.quality !== 'logic' || compareLevels(result.level, level) >= 0) break;
  }
  return result!;
}

/** Baut aus Raster und erzeugten Zahlen ein ladbares Rätsel (mit Lösung). */
export function puzzleFromPattern(width: number, height: number, pattern: Uint8Array,
  result: GenerateResult, title: string, source: string, author = ''): ParsedFile {
  return {
    puzzle: {
      width, height, clues: result.clues,
      solution: Uint8Array.from(pattern, v => (v ? Cell.Filled : Cell.Empty)),
      title, author,
      extra: result.quality === 'logic'
        ? { source, difficulty: result.level, clueCount: result.clueCount, comparisons: result.comparisons }
        : { source }
    },
    progress: null
  };
}

export interface RandomPuzzleOptions {
  width: number;
  height: number;
  level: GeneratorLevel;
  kind: MotifKind | 'any';
  /** Text für das Motiv „Buchstaben“ (leer = zufälliges Wort). */
  text?: string;
  seed?: number;
  onProgress?: (fraction: number) => void;
}

/**
 * Erzeugt ein komplett neues Rätsel: Motiv entwerfen, Zahlen erzeugen.
 * Passt ein Motiv nicht zur gewünschten Stufe (z. B. weil es selbst mit allen Zahlen
 * Vergleiche braucht) oder ist es nicht ohne Raten lösbar, wird ein anderes versucht.
 */
export async function createRandomPuzzle(client: GeneratorClient, opts: RandomPuzzleOptions): Promise<CreatedPuzzle> {
  const MAX_ATTEMPTS = 8;
  let seed = opts.seed ?? newSeed();
  let fallback: CreatedPuzzle | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Motiv vorab prüfen: passt es grundsätzlich zur Stufe? (schnell, daher viele Versuche möglich)
    const motifOpts = { text: opts.text };
    let motif = generateMotif(opts.kind, opts.width, opts.height, seed, motifOpts);
    for (let k = 0; k < 40 && !canReachLevel(opts.width, opts.height, motif.pattern, opts.level); k++) {
      seed = (seed + 7349) >>> 0;
      motif = generateMotif(opts.kind, opts.width, opts.height, seed, motifOpts);
    }
    const result = await generateForLevel(client, opts.width, opts.height, motif.pattern, opts.level,
      f => opts.onProgress?.((attempt - 1 + f) / attempt));
    const text = opts.text?.trim();
    const title = motif.kind === 'letters' && text ? text
      : `${motif.name ?? motifLabel(motif.kind)} ${String(motif.seed % 10000).padStart(4, '0')}`;
    const credit = motif.credit ? `; Vorlage: ${motif.credit}` : '';
    const created = {
      parsed: puzzleFromPattern(opts.width, opts.height, motif.pattern, result, title, `Zufallsmotiv (${motif.kind}, Startwert ${motif.seed})${credit}`,
        // Lizenzhinweis der Vorlage erscheint in der App unter „Autor“
        motif.credit ? `Vorlage: ${motif.credit}` : ''),
      result
    };
    if (result.quality === 'logic' && result.level === opts.level) return created;
    if (!fallback || (fallback.result.quality !== 'logic' && result.quality === 'logic')) fallback = created;
    seed = (seed + 104729) >>> 0;
  }
  return fallback!;
}
