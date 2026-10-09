import { ClueStatus, type Game } from '../core/game';
import { Cell } from '../core/types';
import { prefersReducedMotion } from './dom';
import { mixColor, readPalette, type Palette } from './theme';
import type { ViewState } from './viewState';

/** Breite des äußeren Rahmens in CSS-Pixeln. */
const BORDER = 2;
const MIN_FIT = 12, MAX_FIT = 46;

/** Zeichnet das Spielfeld auf ein Canvas. */
export class BoardView {
  private ctx: CanvasRenderingContext2D;
  private cellSize = 24;
  private dpr = 1;
  private palette: Palette = readPalette();
  private frameRequested = false;

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly container: HTMLElement,
    private readonly game: Game,
    private readonly view: ViewState
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D wird nicht unterstützt.');
    this.ctx = ctx;
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.layout()).observe(container);
    else window.addEventListener('resize', () => this.layout());
  }

  refreshPalette(): void {
    this.palette = readPalette();
    this.requestDraw();
  }

  /** Berechnet die Feldgröße passend zum verfügbaren Platz und Zoom. */
  layout(): void {
    if (!this.game.loaded) return;
    const { width: w, height: h } = this.game;
    const rect = this.container.getBoundingClientRect();
    const narrow = window.innerWidth <= 820;
    const availW = Math.max(120, rect.width - 32);
    const availH = narrow ? window.innerHeight * 0.72 : Math.max(120, rect.height - 32);
    const fit = Math.max(MIN_FIT, Math.min(MAX_FIT, Math.floor(Math.min(availW / w, availH / h))));
    this.cellSize = Math.max(6, Math.round(fit * this.view.zoom));
    this.dpr = window.devicePixelRatio || 1;
    const cssW = this.cellSize * w + 2 * BORDER, cssH = this.cellSize * h + 2 * BORDER;
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    this.draw();
  }

  /** Feldindex unter einer Bildschirmposition, -1 außerhalb. */
  cellAt(clientX: number, clientY: number): number {
    const r = this.canvas.getBoundingClientRect();
    const x = Math.floor((clientX - r.left - BORDER) / this.cellSize);
    const y = Math.floor((clientY - r.top - BORDER) / this.cellSize);
    if (x < 0 || y < 0 || x >= this.game.width || y >= this.game.height) return -1;
    return y * this.game.width + x;
  }

  /** Zeichnet beim nächsten Animationsframe (bündelt mehrere Aufrufe). */
  requestDraw(): void {
    if (this.frameRequested) return;
    this.frameRequested = true;
    requestAnimationFrame(() => { this.frameRequested = false; this.draw(); });
  }

  /** Blendet nach dem Lösen die Zahlen aus und zeigt das Bild. */
  playReveal(): void {
    if (prefersReducedMotion()) { this.view.reveal = 1; this.draw(); return; }
    const start = performance.now();
    const step = (now: number) => {
      this.view.reveal = Math.min(1, (now - start) / 900);
      this.draw();
      if (this.view.reveal < 1 && this.game.solved) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  draw(): void {
    const game = this.game, view = this.view, P = this.palette, ctx = this.ctx;
    if (!game.loaded) return;
    const { width: w, height: h } = game;
    const cs = this.cellSize, O = BORDER;
    // Bei „Lösung zeigen“ wird statt des Spielstands die Lösung gezeichnet (wie ein fertiges Bild)
    const preview = view.showSolution && !!game.solution;
    const cells = preview ? game.solution! : game.cells, clues = game.puzzle.clues;
    const rv = preview ? 1 : game.solved ? view.reveal : 0;
    const numbersVisible = preview || !(game.solved && !view.showNumbers);
    const emptyColor = mixColor(P.cellEmpty, P.cell, rv);
    const statuses = preview ? new Map<number, ClueStatus>() : game.clueStatuses();

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Block der Zahl unter Maus/Cursor
    const focus = [view.hover, view.keyboard ? view.cursor : -1].find(i => i >= 0 && clues[i] >= 0);
    const block = new Set<number>(focus !== undefined && numbersVisible ? game.model.neighbors[focus] : []);

    // Felder
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x, v = cells[i], px = O + x * cs, py = O + y * cs;
        ctx.fillStyle = v === Cell.Filled ? P.fill
          : v === Cell.Empty || game.solved ? emptyColor
          : block.has(i) ? P.hover : P.cell;
        ctx.fillRect(px, py, cs, cs);
        if (v !== Cell.Filled && block.has(i)) {
          ctx.globalAlpha = 0.55; ctx.fillStyle = P.accentSoft; ctx.fillRect(px, py, cs, cs); ctx.globalAlpha = 1;
        }
        if (v === Cell.Empty && clues[i] < 0 && rv < 1 && cs >= 10) {
          ctx.globalAlpha = 1 - rv;
          ctx.fillStyle = P.mark;
          ctx.beginPath();
          ctx.arc(px + cs / 2, py + cs / 2, Math.max(1.5, cs * 0.09), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }

    // Gitter: dünne Linien, alle 5 Felder kräftiger, dazu der Rahmen
    const gw = w * cs, gh = h * cs;
    ctx.globalAlpha = 1 - rv * 0.6;
    ctx.fillStyle = P.line;
    for (let x = 1; x < w; x++) ctx.fillRect(O + x * cs - 0.5, O, 1, gh);
    for (let y = 1; y < h; y++) ctx.fillRect(O, O + y * cs - 0.5, gw, 1);
    ctx.fillStyle = P.lineStrong;
    for (let x = 5; x < w; x += 5) ctx.fillRect(O + x * cs - 1, O, 2, gh);
    for (let y = 5; y < h; y += 5) ctx.fillRect(O, O + y * cs - 1, gw, 2);
    ctx.globalAlpha = 1;
    ctx.fillRect(0, 0, gw + 2 * O, O);
    ctx.fillRect(0, gh + O, gw + 2 * O, O);
    ctx.fillRect(0, 0, O, gh + 2 * O);
    ctx.fillRect(gw + O, 0, O, gh + 2 * O);

    // Zahlen
    const marks = preview ? null : view.marks;
    const markedClues = new Set(marks?.clues ?? []);
    const numberAlpha = numbersVisible ? 1 : 1 - rv;
    if (numberAlpha > 0 && cs >= 8) {
      ctx.font = `700 ${Math.max(7, Math.round(cs * 0.58))}px "Atkinson Hyperlegible", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const c of game.model.clueCells) {
        const cx = O + (c % w) * cs + cs / 2, cy = O + Math.floor(c / w) * cs + cs / 2;
        const status = statuses.get(c);
        if (markedClues.has(c)) {
          ctx.globalAlpha = numberAlpha;
          ctx.fillStyle = marks?.error ? P.danger : P.accent;
          ctx.beginPath(); ctx.arc(cx, cy, cs * 0.44, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = P.cell;
        } else {
          ctx.globalAlpha = numberAlpha * (status === ClueStatus.Done ? 0.34 : 1);
          ctx.fillStyle = status === ClueStatus.Error ? P.danger : cells[c] === Cell.Filled ? P.onFill : P.ink;
        }
        ctx.fillText(String(clues[c]), cx, cy + cs * 0.03);
      }
      ctx.globalAlpha = 1;
    }

    // Rahmen um den 3×3-Block
    if (focus !== undefined && block.size) {
      const fx = focus % w, fy = Math.floor(focus / w);
      const x0 = Math.max(0, fx - 1), y0 = Math.max(0, fy - 1);
      const x1 = Math.min(w - 1, fx + 1), y1 = Math.min(h - 1, fy + 1);
      ctx.strokeStyle = P.accent; ctx.lineWidth = 2;
      ctx.strokeRect(O + x0 * cs + 1, O + y0 * cs + 1, (x1 - x0 + 1) * cs - 2, (y1 - y0 + 1) * cs - 2);
    }

    // Hinweis-Felder
    if (marks?.cells.length) {
      ctx.strokeStyle = marks.error ? P.danger : P.accent;
      ctx.lineWidth = Math.max(2, cs * 0.12);
      ctx.setLineDash(marks.error ? [] : [Math.max(3, cs * 0.2), Math.max(2, cs * 0.12)]);
      const inset = ctx.lineWidth / 2 + 1;
      for (const i of marks.cells) {
        ctx.strokeRect(O + (i % w) * cs + inset, O + Math.floor(i / w) * cs + inset, cs - 2 * inset, cs - 2 * inset);
      }
      ctx.setLineDash([]);
    }

    // Fehlerkreuze
    const errors = preview ? null : view.checkedErrors ?? (view.liveErrors ? game.wrongCells() : null);
    if (errors?.length) {
      ctx.strokeStyle = P.danger; ctx.lineWidth = Math.max(2, cs * 0.1); ctx.lineCap = 'round';
      const m = cs * 0.24;
      for (const i of errors) {
        const px = O + (i % w) * cs, py = O + Math.floor(i / w) * cs;
        ctx.beginPath();
        ctx.moveTo(px + m, py + m); ctx.lineTo(px + cs - m, py + cs - m);
        ctx.moveTo(px + cs - m, py + m); ctx.lineTo(px + m, py + cs - m);
        ctx.stroke();
      }
    }

    // Tastatur-Cursor
    if (view.keyboard && view.cursor >= 0) {
      const px = O + (view.cursor % w) * cs, py = O + Math.floor(view.cursor / w) * cs;
      ctx.strokeStyle = P.accent; ctx.lineWidth = 3;
      ctx.strokeRect(px + 1.5, py + 1.5, cs - 3, cs - 3);
    }
  }
}
