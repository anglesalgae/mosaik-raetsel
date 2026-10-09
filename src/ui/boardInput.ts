import type { Game } from '../core/game';
import { Cell, type Change, type CellState } from '../core/types';
import type { BoardView } from './boardView';
import type { ViewState } from './viewState';

export interface BoardInputActions {
  /** false, wenn gerade nicht bearbeitet werden darf (z. B. während die Lösung angezeigt wird). */
  canEdit(): boolean;
  /** Wird vor jeder Änderung durch den Nutzer aufgerufen (z. B. Hinweis verwerfen). */
  beforeEdit(): void;
  hint(): void;
  save(): void;
  setTool(tool: CellState): void;
}

interface Stroke {
  erase: boolean;
  target: CellState;
  from: CellState;
  last: number;
  original: Map<number, CellState>;
}

/**
 * Maus-, Touch- und Tastatureingabe für das Spielfeld.
 * Ziehen bemalt mehrere Felder; ein Strich ist ein Schritt im Verlauf.
 */
export class BoardInput {
  private stroke: Stroke | null = null;

  constructor(
    private readonly board: BoardView,
    private readonly game: Game,
    private readonly view: ViewState,
    private readonly actions: BoardInputActions
  ) {
    const c = board.canvas;
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('pointerdown', e => this.onPointerDown(e));
    c.addEventListener('pointermove', e => this.onPointerMove(e));
    c.addEventListener('pointerup', () => this.endStroke());
    c.addEventListener('pointercancel', () => this.endStroke());
    c.addEventListener('pointerleave', () => {
      if (!this.stroke && view.hover >= 0) { view.hover = -1; board.requestDraw(); }
    });
    c.addEventListener('focus', () => { if (view.cursor < 0) view.cursor = 0; });
    c.addEventListener('blur', () => { if (view.keyboard) { view.keyboard = false; board.requestDraw(); } });
    document.addEventListener('keydown', e => this.onKeyDown(e));
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.game.loaded || e.button === 1) return;
    const i = this.board.cellAt(e.clientX, e.clientY);
    if (i < 0) return;
    e.preventDefault();
    if (!this.actions.canEdit()) return;
    this.board.canvas.focus({ preventScroll: true });
    try { this.board.canvas.setPointerCapture(e.pointerId); } catch { /* ignorieren */ }
    this.actions.beforeEdit();
    this.view.keyboard = false;
    this.view.cursor = i;

    let tool = this.view.tool;
    if (e.button === 2 || e.shiftKey) tool = tool === Cell.Empty ? Cell.Filled : Cell.Empty;
    const from = this.game.cells[i] as CellState;
    this.stroke = tool === Cell.Unknown
      ? { erase: true, target: Cell.Unknown, from, last: i, original: new Map() }
      : { erase: false, target: from === tool ? Cell.Unknown : tool, from, last: i, original: new Map() };
    this.paint(i, true);
    this.board.requestDraw();
  }

  private onPointerMove(e: PointerEvent): void {
    const i = this.board.cellAt(e.clientX, e.clientY);
    const s = this.stroke;
    if (s) {
      if (i >= 0 && i !== s.last) {
        for (const j of this.line(s.last, i)) this.paint(j, false);
        s.last = i;
        this.board.requestDraw();
      }
    } else if (e.pointerType === 'mouse' && i !== this.view.hover) {
      this.view.hover = i;
      this.board.requestDraw();
    }
  }

  /** Bemalt ein Feld. Beim Ziehen werden nur Felder mit dem Startzustand verändert. */
  private paint(i: number, first: boolean): void {
    const s = this.stroke!;
    const v = this.game.cells[i] as CellState;
    const allowed = first || (s.erase ? v !== Cell.Unknown : v === s.from);
    if (!allowed || v === s.target) return;
    if (!s.original.has(i)) s.original.set(i, v);
    this.game.setCellRaw(i, s.target);
  }

  private endStroke(): void {
    const s = this.stroke;
    if (!s) return;
    this.stroke = null;
    const changes: Change[] = [];
    for (const [i, from] of s.original) {
      const to = this.game.cells[i] as CellState;
      if (to !== from) changes.push([i, from, to]);
    }
    this.game.commit(changes);
    this.board.requestDraw();
  }

  /** Felder auf der Linie zwischen a und b (Bresenham), damit schnelles Ziehen keine Lücken lässt. */
  private line(a: number, b: number): number[] {
    const w = this.game.width;
    let x0 = a % w, y0 = Math.floor(a / w);
    const x1 = b % w, y1 = Math.floor(b / w);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    const out: number[] = [];
    for (;;) {
      out.push(y0 * w + x0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return out;
  }

  private setAtCursor(value: CellState): void {
    if (!this.actions.canEdit()) return;
    const view = this.view;
    if (view.cursor < 0) view.cursor = 0;
    this.actions.beforeEdit();
    const current = this.game.cells[view.cursor];
    const target = value === Cell.Unknown || current === value ? Cell.Unknown : value;
    this.game.set([view.cursor], target);
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.game.loaded) return;
    const t = e.target as HTMLElement | null;
    const typing = t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && !['radio', 'checkbox', 'range'].includes((t as HTMLInputElement).type)));
    if (typing || document.querySelector('dialog[open]')) return;

    const key = e.key.toLowerCase();
    if (e.ctrlKey || e.metaKey) {
      if ((key === 'z' || key === 'y') && !this.actions.canEdit()) { e.preventDefault(); return; }
      if (key === 'z') { e.preventDefault(); this.actions.beforeEdit(); if (e.shiftKey) this.game.redo(); else this.game.undo(); }
      else if (key === 'y') { e.preventDefault(); this.actions.beforeEdit(); this.game.redo(); }
      else if (key === 's') { e.preventDefault(); this.actions.save(); }
      return;
    }
    if (e.altKey) return;

    const onBoard = t === this.board.canvas;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]
    };
    const move = moves[e.key];
    if (onBoard && move) {
      e.preventDefault();
      const view = this.view;
      view.keyboard = true;
      if (view.cursor < 0) view.cursor = 0;
      else {
        const { width: w, height: h } = this.game;
        const x = Math.min(w - 1, Math.max(0, (view.cursor % w) + move[0]));
        const y = Math.min(h - 1, Math.max(0, Math.floor(view.cursor / w) + move[1]));
        view.cursor = y * w + x;
      }
      this.board.requestDraw();
      return;
    }
    if (onBoard && (e.key === ' ' || e.key === 'Enter' || key === 'f')) {
      e.preventDefault(); this.view.keyboard = true; this.setAtCursor(Cell.Filled); return;
    }
    if (onBoard && (key === 'x' || e.key === '.')) {
      e.preventDefault(); this.view.keyboard = true; this.setAtCursor(Cell.Empty); return;
    }
    if (onBoard && (e.key === 'Backspace' || e.key === 'Delete')) {
      e.preventDefault(); this.view.keyboard = true; this.setAtCursor(Cell.Unknown); return;
    }
    if (key === 'h') { e.preventDefault(); this.actions.hint(); return; }
    const tools: Record<string, CellState> = { '1': Cell.Filled, '2': Cell.Empty, '3': Cell.Unknown };
    if (tools[e.key] !== undefined) this.actions.setTool(tools[e.key]);
  }
}
