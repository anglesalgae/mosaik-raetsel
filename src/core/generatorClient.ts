import { generatePuzzle, type GenerateResult, type GeneratorLevel } from './generator';
import type { GenerateMessage, GenerateRequest } from './generator.worker';

export interface GenerateJob {
  width: number;
  height: number;
  pattern: Uint8Array;
  level: GeneratorLevel;
  seed?: number;
  onProgress?: (fraction: number) => void;
}

/** Führt den Generator in einem Web Worker aus; abbrechbar, mit Fallback im Hauptthread. */
export class GeneratorClient {
  private worker: Worker | null = null;
  private nextId = 0;
  private reject: ((e: Error) => void) | null = null;

  run(job: GenerateJob): Promise<GenerateResult> {
    this.cancel();
    const id = ++this.nextId;
    const seed = job.seed ?? Math.floor(Math.random() * 2 ** 31);
    return new Promise((resolve, reject) => {
      const inline = () => setTimeout(() => {
        try { resolve(generatePuzzle(job.width, job.height, job.pattern, { level: job.level, seed, onProgress: job.onProgress })); }
        catch (e) { reject(e as Error); }
      }, 20);

      let worker: Worker;
      try {
        worker = new Worker(new URL('./generator.worker.ts', import.meta.url), { type: 'module' });
      } catch {
        inline();
        return;
      }
      this.worker = worker;
      this.reject = reject;
      worker.onmessage = (e: MessageEvent<GenerateMessage>) => {
        if (e.data.id !== id) return;
        if (e.data.type === 'progress') job.onProgress?.(e.data.fraction);
        else { this.finish(); resolve(e.data.result); }
      };
      worker.onerror = ev => {
        ev.preventDefault();
        this.finish();
        inline();
      };
      const req: GenerateRequest = { id, width: job.width, height: job.height, pattern: job.pattern, level: job.level, seed };
      worker.postMessage(req);
    });
  }

  /** Bricht die laufende Erzeugung ab (das Promise wird mit „abgebrochen“ verworfen). */
  cancel(): void {
    const reject = this.reject;
    this.finish();
    reject?.(new Error('abgebrochen'));
  }

  private finish(): void {
    this.worker?.terminate();
    this.worker = null;
    this.reject = null;
  }
}
