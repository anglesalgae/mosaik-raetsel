/** Lädt Bilder und tastet sie in ein grobes Raster aus Helligkeitswerten ab. */

export interface LoadedImage {
  image: HTMLImageElement;
  width: number;
  height: number;
  name: string;
  /** Gibt die Objekt-URL wieder frei. */
  dispose(): void;
}

const MAX_IMAGE_BYTES = 25_000_000;

export async function loadImageFile(file: File): Promise<LoadedImage> {
  if (!file.type.startsWith('image/')) throw new Error('Die Datei ist kein Bild.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Das Bild ist größer als 25 MB.');
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error('Das Bild konnte nicht gelesen werden.');
  }
  return {
    image, width: image.naturalWidth, height: image.naturalHeight,
    name: file.name.replace(/\.[^.]+$/, ''),
    dispose: () => URL.revokeObjectURL(url)
  };
}

/**
 * Mittlere Helligkeit (0 = schwarz … 255 = weiß) für jedes Rasterfeld.
 * Transparente Bereiche gelten als weiß.
 */
export function sampleLuminance(img: LoadedImage, cols: number, rows: number): Float32Array {
  // Pro Rasterfeld k×k Pixel mitteln (genauer als einfaches Verkleinern)
  const k = Math.max(1, Math.min(8, Math.floor(1024 / Math.max(cols, rows))));
  const cw = cols * k, ch = rows * k;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D wird nicht unterstützt.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cw, ch);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img.image, 0, 0, cw, ch);
  const data = ctx.getImageData(0, 0, cw, ch).data;

  const out = new Float32Array(cols * rows);
  const area = k * k;
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      let sum = 0;
      for (let y = gy * k; y < gy * k + k; y++) {
        let p = (y * cw + gx * k) * 4;
        for (let x = 0; x < k; x++, p += 4) {
          sum += 0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2];
        }
      }
      out[gy * cols + gx] = sum / area;
    }
  }
  return out;
}
