import { buildModel, solve } from './solver';
import type { SolveOutcome } from './types';

export interface SolveRequest {
  id: number;
  width: number;
  height: number;
  clues: Int8Array;
  nodeLimit: number;
}

export interface SolveResponse {
  id: number;
  outcome: SolveOutcome;
}

/** Minimaler Typ für den Worker-Kontext (vermeidet Konflikte zwischen DOM- und WebWorker-Typen). */
interface WorkerScope {
  onmessage: ((e: MessageEvent<SolveRequest>) => void) | null;
  postMessage(message: SolveResponse): void;
}
const ctx = self as unknown as WorkerScope;

ctx.onmessage = (e: MessageEvent<SolveRequest>) => {
  const { id, width, height, clues, nodeLimit } = e.data;
  const outcome = solve(buildModel(width, height, clues), { maxSolutions: 2, nodeLimit });
  const res: SolveResponse = { id, outcome };
  ctx.postMessage(res);
};
