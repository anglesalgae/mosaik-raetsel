/**
 * Einfache Silhouetten (Tiere und Gegenstände) für das Motiv „Figuren“.
 * Jede Form ist eine Funktion inside(u, v) im Einheitsquadrat u, v ∈ [-1, 1] (v nach unten),
 * sodass sie sich in jeder Rastergröße sauber zeichnen lässt.
 */
type Point = readonly [number, number];
export type Inside = (u: number, v: number) => boolean;

const circle = (u: number, v: number, cx: number, cy: number, r: number) => (u - cx) ** 2 + (v - cy) ** 2 <= r * r;
const ellipse = (u: number, v: number, cx: number, cy: number, rx: number, ry: number) =>
  ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 <= 1;
const rect = (u: number, v: number, x0: number, x1: number, y0: number, y1: number) =>
  u >= x0 && u <= x1 && v >= y0 && v <= y1;

/** Punkt-in-Polygon (Strahlverfahren). */
function polygon(u: number, v: number, pts: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > v) !== (yj > v) && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const STAR: Point[] = Array.from({ length: 10 }, (_, k) => {
  const r = k % 2 ? 0.42 : 1, a = -Math.PI / 2 + (k * Math.PI) / 5;
  return [r * Math.cos(a), r * Math.sin(a) + 0.08] as const;
});

export const SILHOUETTES: readonly { name: string; inside: Inside }[] = [
  {
    name: 'Herz',
    inside: (u, v) => {
      const x = u * 1.2, y = -v * 1.25 + 0.1;
      return (x * x + y * y - 1) ** 3 - x * x * y ** 3 <= 0;
    }
  },
  { name: 'Stern', inside: (u, v) => polygon(u, v, STAR) },
  {
    name: 'Haus',
    inside: (u, v) =>
      (rect(u, v, -0.65, 0.65, -0.05, 0.95) || polygon(u, v, [[-0.85, -0.05], [0, -0.85], [0.85, -0.05]])
        || rect(u, v, 0.35, 0.55, -0.75, -0.3))
      && !rect(u, v, -0.15, 0.15, 0.4, 0.95)
      && !rect(u, v, -0.5, -0.25, 0.15, 0.4) && !rect(u, v, 0.25, 0.5, 0.15, 0.4)
  },
  {
    name: 'Fisch',
    inside: (u, v) =>
      (ellipse(u, v, -0.15, 0, 0.65, 0.4) || polygon(u, v, [[0.4, 0], [0.95, -0.45], [0.95, 0.45]])
        || polygon(u, v, [[-0.3, -0.3], [0.15, -0.3], [-0.05, -0.6]]))
      && !circle(u, v, -0.5, -0.08, 0.09)
  },
  {
    name: 'Katze',
    inside: (u, v) =>
      (circle(u, v, 0, 0.15, 0.7)
        || polygon(u, v, [[-0.65, -0.1], [-0.55, -0.85], [-0.1, -0.45]])
        || polygon(u, v, [[0.65, -0.1], [0.55, -0.85], [0.1, -0.45]]))
      && !ellipse(u, v, -0.27, 0.05, 0.1, 0.15) && !ellipse(u, v, 0.27, 0.05, 0.1, 0.15)
      && !polygon(u, v, [[-0.1, 0.3], [0.1, 0.3], [0, 0.43]])
  },
  {
    name: 'Vogel',
    inside: (u, v) =>
      (ellipse(u, v, -0.05, 0.15, 0.55, 0.35) || circle(u, v, 0.45, -0.25, 0.25)
        || polygon(u, v, [[0.65, -0.35], [0.97, -0.24], [0.65, -0.13]])
        || polygon(u, v, [[-0.45, 0.05], [-0.97, -0.3], [-0.85, 0.3]]))
      && !circle(u, v, 0.5, -0.3, 0.06)
  },
  {
    name: 'Tasse',
    inside: (u, v) =>
      rect(u, v, -0.65, 0.3, -0.45, 0.6)
      || (u > 0.3 && circle(u, v, 0.35, 0.07, 0.38) && !circle(u, v, 0.35, 0.07, 0.2))
      || rect(u, v, -0.9, 0.6, 0.68, 0.82)
  },
  {
    name: 'Baum',
    inside: (u, v) =>
      rect(u, v, -0.12, 0.12, 0.55, 0.95)
      || polygon(u, v, [[-0.7, 0.6], [0.7, 0.6], [0, 0.0]])
      || polygon(u, v, [[-0.6, 0.25], [0.6, 0.25], [0, -0.4]])
      || polygon(u, v, [[-0.48, -0.12], [0.48, -0.12], [0, -0.92]])
  },
  { name: 'Mond', inside: (u, v) => circle(u, v, 0, 0, 0.88) && !circle(u, v, 0.38, -0.22, 0.72) },
  {
    name: 'Apfel',
    inside: (u, v) =>
      circle(u, v, -0.27, 0.2, 0.58) || circle(u, v, 0.27, 0.2, 0.58)
      || rect(u, v, -0.04, 0.06, -0.78, -0.3) || ellipse(u, v, 0.28, -0.62, 0.24, 0.11)
  },
  {
    name: 'Pilz',
    inside: (u, v) =>
      ((v <= 0.05 && ellipse(u, v, 0, 0.05, 0.92, 0.8)) || rect(u, v, -0.25, 0.25, 0.05, 0.88))
      && !circle(u, v, -0.42, -0.25, 0.14) && !circle(u, v, 0.18, -0.45, 0.12) && !circle(u, v, 0.48, -0.12, 0.1)
  }
];
