/**
 * Reine Funktionen zur Umwandlung von Helligkeitswerten in ein Schwarz-Weiß-Raster.
 * Keine DOM-Abhängigkeiten, daher direkt testbar.
 */

/** Schwelle nach Otsu: trennt Hell und Dunkel so, dass beide Gruppen möglichst einheitlich sind. */
export function otsuThreshold(lum: ArrayLike<number>): number {
  const hist = new Float64Array(256);
  for (let i = 0; i < lum.length; i++) hist[Math.max(0, Math.min(255, Math.round(lum[i])))]++;
  const total = lum.length;
  if (!total) return 128;
  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * hist[t];
  let sumB = 0, wB = 0, best = -1, threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; threshold = t + 0.5; }
  }
  return Math.max(1, Math.min(254, Math.round(threshold)));
}

/** Dunkle Felder (Helligkeit unter der Schwelle) werden gefüllt; mit invert umgekehrt. */
export function toPattern(lum: ArrayLike<number>, threshold: number, invert: boolean): Uint8Array {
  const out = new Uint8Array(lum.length);
  for (let i = 0; i < lum.length; i++) out[i] = (lum[i] < threshold) !== invert ? 1 : 0;
  return out;
}

/**
 * Entfernt einzelne Ausreißer: Ein gefülltes Feld mit höchstens einem gefüllten Nachbarn
 * wird leer, ein leeres Feld mit mindestens sieben gefüllten Nachbarn wird gefüllt.
 */
export function smoothPattern(pattern: Uint8Array, w: number, h: number): Uint8Array {
  const out = Uint8Array.from(pattern);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let filled = 0, total = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        total++;
        filled += pattern[yy * w + xx];
      }
      const i = y * w + x;
      if (pattern[i] && filled <= 1) out[i] = 0;
      else if (!pattern[i] && filled >= Math.min(7, total)) out[i] = 1;
    }
  }
  return out;
}

/**
 * Lage des Bildes in einer Fläche w × h: unverzerrt, so groß wie möglich und mittig.
 * Bei abweichendem Seitenverhältnis bleibt links/rechts bzw. oben/unten ein weißer Streifen.
 */
export function containRect(imgW: number, imgH: number, w: number, h: number): { x: number; y: number; w: number; h: number } {
  if (!imgW || !imgH) return { x: 0, y: 0, w, h };
  const s = Math.min(w / imgW, h / imgH);
  const dw = imgW * s, dh = imgH * s;
  return { x: (w - dw) / 2, y: (h - dh) / 2, w: dw, h: dh };
}

/** Anteil gefüllter Felder (0…1). */
export function fillRatio(pattern: ArrayLike<number>): number {
  let f = 0;
  for (let i = 0; i < pattern.length; i++) f += pattern[i] ? 1 : 0;
  return pattern.length ? f / pattern.length : 0;
}
