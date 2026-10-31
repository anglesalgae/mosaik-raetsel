import type { GeneratorLevel } from '../core/generator';
import { LEVEL_NAMES, difficultyDiamondSvg, skullSvg } from './difficulty';
import { byId, formatTime } from './dom';

/** Kopfzeile: Titel, Größe, Zeit, Fortschritt sowie Rückgängig/Wiederholen. */
export class Header {
  private title = byId('pTitle');
  private subtitle = byId('pSub');
  private level = byId('pLevel');
  private note = byId('pNote');
  private timer = byId('timer');
  private bar = byId('progBar');
  private percent = byId('progTxt');
  private undoBtn = byId<HTMLButtonElement>('undoBtn');
  private redoBtn = byId<HTMLButtonElement>('redoBtn');

  constructor(actions: { undo(): void; redo(): void }) {
    this.undoBtn.addEventListener('click', actions.undo);
    this.redoBtn.addEventListener('click', actions.redo);
  }

  setPuzzle(title: string, width: number, height: number): void {
    this.title.textContent = title;
    this.subtitle.textContent = `${width} × ${height}`;
    document.title = `${title} – Mosaik`;
    this.setNote(null);
  }

  /** Dauerhafte Angaben zum Rätsel in der Kopfzeile (z. B. nach dem Erstellen); null blendet sie aus. */
  setNote(text: string | null): void {
    this.note.hidden = !text;
    this.note.textContent = text ?? '';
    this.note.title = text ?? '';
  }

  /**
   * Zeigt die Schwierigkeit neben dem Titel; null blendet die Anzeige aus.
   * deadly: besonders viele Vergleiche – Totenschädel statt Raute.
   */
  setDifficulty(level: GeneratorLevel | null, deadly = false): void {
    this.level.hidden = !level;
    if (!level) { this.level.replaceChildren(); return; }
    this.level.innerHTML = `${deadly ? skullSvg() : difficultyDiamondSvg(level)}<span>${LEVEL_NAMES[level]}</span>`;
    this.level.title = `Schwierigkeit: ${LEVEL_NAMES[level]}${deadly ? ' – besonders viele Vergleiche' : ''}`;
  }

  setTime(seconds: number): void {
    this.timer.textContent = formatTime(seconds);
  }

  setProgress(fraction: number): void {
    const pct = Math.round(fraction * 100);
    this.bar.style.width = `${pct}%`;
    this.percent.textContent = `${pct} %`;
  }

  setHistory(canUndo: boolean, canRedo: boolean): void {
    this.undoBtn.disabled = !canUndo;
    this.redoBtn.disabled = !canRedo;
  }
}
