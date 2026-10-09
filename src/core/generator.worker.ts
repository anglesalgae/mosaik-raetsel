import { generatePuzzle, type GenerateResult, type GeneratorLevel } from './generator';

export interface GenerateRequest {
  id: number;
  width: number;
  height: number;
  pattern: Uint8Array;
  level: GeneratorLevel;
  seed: number;
}

export type GenerateMessage =
  | { id: number; type: 'progress'; fraction: number }
  | { id: number; type: 'done'; result: GenerateResult };

interface WorkerScope {
  onmessage: ((e: MessageEvent<GenerateRequest>) => void) | null;
  postMessage(message: GenerateMessage): void;
}
const ctx = self as unknown as WorkerScope;

ctx.onmessage = (e: MessageEvent<GenerateRequest>) => {
  const { id, width, height, pattern, level, seed } = e.data;
  let last = 0;
  const result = generatePuzzle(width, height, pattern, {
    level, seed,
    onProgress: fraction => {
      const now = Date.now();
      if (now - last > 80 || fraction === 1) { last = now; ctx.postMessage({ id, type: 'progress', fraction }); }
    }
  });
  ctx.postMessage({ id, type: 'done', result });
};
