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

/**
 * Totenschädel als SVG (in Textfarbe) für besonders schwere Rätsel (siehe isDeadly).
 * Entspricht dem Totenschädel in den exportierten Bildern.
 */
export function skullSvg(): string {
  return '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">'
    + '<mask id="skullHoles"><rect width="16" height="16" fill="#fff"/>'
    + '<circle cx="5.6" cy="7.5" r="1.6"/><circle cx="10.4" cy="7.5" r="1.6"/>'
    + '<path d="M8 9.1 L9 11 L7 11 Z"/>'
    + '<rect x="5.92" y="13.3" width="0.64" height="2.6"/><rect x="7.68" y="13.3" width="0.64" height="2.6"/>'
    + '<rect x="9.44" y="13.3" width="0.64" height="2.6"/></mask>'
    + '<g fill="currentColor" mask="url(#skullHoles)"><circle cx="8" cy="6.9" r="6.1"/>'
    + '<rect x="4.5" y="10.1" width="7" height="5.8"/></g></svg>';
}
