/** Farben aus den CSS-Variablen, damit Canvas und CSS dasselbe Farbschema nutzen. */
export interface Palette {
  cell: string;
  cellEmpty: string;
  fill: string;
  onFill: string;
  line: string;
  lineStrong: string;
  ink: string;
  accent: string;
  accentSoft: string;
  danger: string;
  mark: string;
  hover: string;
}

export function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string) => cs.getPropertyValue(`--${name}`).trim();
  return {
    cell: v('cell'), cellEmpty: v('cell-empty'), fill: v('fill'), onFill: v('on-fill'),
    line: v('line'), lineStrong: v('line-strong'), ink: v('ink'), accent: v('accent'),
    accentSoft: v('accent-soft'), danger: v('danger'), mark: v('mark'), hover: v('hover')
  };
}

/** Ruft `onChange` auf, wenn das System- oder Seiten-Farbschema wechselt. */
export function watchTheme(onChange: () => void): void {
  if (typeof matchMedia === 'function') {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onChange);
  }
  new MutationObserver(onChange).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

/** Mischt zwei Hex-Farben (#rrggbb). */
export function mixColor(a: string, b: string, t: number): string {
  const re = /^#[0-9a-f]{6}$/i;
  if (!re.test(a) || !re.test(b)) return t < 0.5 ? a : b;
  const parse = (s: string) => [1, 3, 5].map(k => parseInt(s.slice(k, k + 2), 16));
  const A = parse(a), B = parse(b);
  return '#' + A.map((x, k) => Math.round(x + (B[k] - x) * t).toString(16).padStart(2, '0')).join('');
}
