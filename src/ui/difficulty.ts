import type { GeneratorLevel } from '../core/generator';

export const LEVEL_NAMES: Record<GeneratorLevel, string> = {
  easy: 'Normal', moderate: 'Fortgeschritten', medium: 'Knifflig'
};

/**
 * Raute als SVG (in Textfarbe): leer = Normal,
 * linke Hälfte gefüllt (senkrecht geteilt) = Fortgeschritten, gefüllt = Knifflig.
 * Entspricht der Raute in den exportierten Bildern.
 */
export function difficultyDiamondSvg(level: GeneratorLevel): string {
  const shape = 'M8 1.5 L14.5 8 L8 14.5 L1.5 8 Z';
  const fill = level === 'medium'
    ? `<path d="${shape}" fill="currentColor"/>`
    : level === 'moderate'
      ? `<clipPath id="dHalf"><path d="${shape}"/></clipPath><rect x="0" y="0" width="8" height="16" fill="currentColor" clip-path="url(#dHalf)"/>`
      : '';
  return `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">${fill}<path d="${shape}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="miter"/></svg>`;
}
