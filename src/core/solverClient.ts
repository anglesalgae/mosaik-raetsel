import { buildModel, solve } from './solver';
import type { Puzzle, SolveOutcome } from './types';
import type { SolveRequest, SolveResponse } from './solver.worker';

const NODE_LIMIT = 200_000;

interface Pending {
  id: number;
  puzzle: Puzzle;
  resolve: (o: SolveOutcome | null) => void;
}

/**
 * Führt den Löser in einem Web Worker aus, damit große Rätsel die Oberfläche
 * nicht blockieren. Ohne Worker-Unterstützung läuft er im Hauptthread.
 * Ein neuer Auftrag bricht den vorherigen ab (dessen Promise liefert null).
 */
export class SolverClient {
  private worker: Worker | null = null;
  private workerFailed = false;
  private nextId = 0;
  private pending: Pending | null = null;

  solve(puzzle: Puzzle): Promise<SolveOutcome | null> {
    this.cancel();
    const id = ++this.nextId;
    return new Promise(resolve => {
      const worker = this.getWorker();
      if (!worker) {
        this.solveInline(id, puzzle, resolve);
        return;
      }
      this.pending = { id, puzzle, resolve };
      const req: SolveRequest = { id, width: puzzle.width, height: puzzle.height, clues: puzzle.clues, nodeLimit: NODE_LIMIT };
      worker.postMessage(req);
    });
  }

  cancel(): void {
    if (!this.pending) return;
    this.pending.resolve(null);
    this.pending = null;
    this.worker?.terminate();
    this.worker = null;
  }

  private solveInline(id: number, puzzle: Puzzle, resolve: (o: SolveOutcome | null) => void): void {
    setTimeout(() => {
      if (id !== this.nextId) return resolve(null);
      resolve(solve(buildModel(puzzle.width, puzzle.height, puzzle.clues), { nodeLimit: NODE_LIMIT }));
    }, 20);
  }

  private getWorker(): Worker | null {
    if (this.worker) return this.worker;
    if (this.workerFailed || typeof Worker === 'undefined') return null;
    try {
      const w = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<SolveResponse>) => {
        if (this.pending && e.data.id === this.pending.id) {
          this.pending.resolve(e.data.outcome);
          this.pending = null;
        }
      };
      w.onerror = () => {
        // Worker nicht nutzbar (z. B. per file:// geöffnet): im Hauptthread weiterrechnen
        this.workerFailed = true;
        w.terminate();
        this.worker = null;
        const p = this.pending;
        this.pending = null;
        if (p) this.solveInline(p.id, p.puzzle, p.resolve);
      };
      this.worker = w;
      return w;
    } catch {
      this.workerFailed = true;
      return null;
    }
  }
}
