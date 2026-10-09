import type { SaveFile } from '../core/types';

/** Beispielrätsel, das beim ersten Start geladen wird (15 × 15, eindeutig, ohne Raten lösbar). */
export const EXAMPLE_PUZZLE: SaveFile = {
  format: 'fill-a-pix',
  version: 1,
  title: 'Segelboot',
  author: 'Mosaik-Beispiel',
  width: 15,
  height: 15,
  clues: [
    '...0.0...1.....',
    '.0.....5..1..0.',
    '..0.335.8.....0',
    '.......6.......',
    '0.36.......63..',
    '1..896....9..3.',
    '..5...5.7...53.',
    '3..6.5..7..6.5.',
    '........6..56..',
    '3.888..8.8..86.',
    '.3..5..........',
    '..23.....3....0',
    '.1.2.00..2.001.',
    '2.3.3.......33.',
    '.......3.3.3...'
  ]
};

/** Kleine Vorlage für den Dialog „Dateiformat“. */
export const TEMPLATE_PUZZLE: SaveFile = {
  format: 'fill-a-pix',
  version: 1,
  title: 'Kleines Beispiel',
  width: 5,
  height: 5,
  clues: ['..5..', '57..5', '5.9.5', '.6...', '1..3.'],
  solution: ['.#.#.', '#####', '#####', '.###.', '..#..']
};
