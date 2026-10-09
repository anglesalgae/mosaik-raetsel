import type { Puzzle, SolveStatus, CellState } from '../core/types';
import { byId } from './dom';

export interface SidebarActions {
  openFile(file: File): void;
  save(): void;
  openJsonDialog(): void;
  openFormatDialog(): void;
  openCreator(): void;
  randomPuzzle(): void;
  loadExample(): void;
  setTool(tool: CellState): void;
  hint(): void;
  check(): void;
  toggleSolution(): void;
  reset(): void;
  setLiveErrors(on: boolean): void;
  setZoom(zoom: number): void;
  setShowNumbers(on: boolean): void;
}

/** Seitenleiste mit Datei-, Werkzeug-, Hilfe- und Ansichtsbereich. */
export class Sidebar {
  private hintBtn = byId<HTMLButtonElement>('hintBtn');
  private solveBtn = byId<HTMLButtonElement>('solveBtn');
  private showNums = byId<HTMLInputElement>('showNums');
  private solvInfo = byId('iSolv');
  private randomBtn = byId<HTMLButtonElement>('randomBtn');

  constructor(actions: SidebarActions) {
    const fileInput = byId<HTMLInputElement>('fileInput');
    byId('openBtn').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) actions.openFile(file);
      fileInput.value = '';
    });
    byId('saveBtn').addEventListener('click', actions.save);
    byId('pasteBtn').addEventListener('click', actions.openJsonDialog);
    byId('formatBtn').addEventListener('click', actions.openFormatDialog);
    byId('createBtn').addEventListener('click', actions.openCreator);
    this.randomBtn.addEventListener('click', actions.randomPuzzle);
    byId('exampleBtn').addEventListener('click', actions.loadExample);

    document.querySelectorAll<HTMLInputElement>('input[name="tool"]').forEach(radio =>
      radio.addEventListener('change', () => actions.setTool(Number(radio.value) as CellState)));

    this.hintBtn.addEventListener('click', actions.hint);
    byId('checkBtn').addEventListener('click', actions.check);
    this.solveBtn.addEventListener('click', actions.toggleSolution);
    byId('resetBtn').addEventListener('click', actions.reset);
    byId<HTMLInputElement>('liveErr').addEventListener('change', e => actions.setLiveErrors((e.target as HTMLInputElement).checked));
    byId<HTMLInputElement>('zoom').addEventListener('input', e => actions.setZoom(Number((e.target as HTMLInputElement).value)));
    this.showNums.addEventListener('change', () => actions.setShowNumbers(this.showNums.checked));
  }

  setTool(tool: CellState): void {
    const radio = document.querySelector<HTMLInputElement>(`input[name="tool"][value="${tool}"]`);
    if (radio) radio.checked = true;
  }

  /** Zeigt an, ob der nächste Klick auf „Hinweis“ den Schritt anwendet. */
  setHintPending(pending: boolean): void {
    this.hintBtn.firstChild!.textContent = pending ? 'Hinweis anwenden ' : 'Hinweis ';
    this.hintBtn.classList.toggle('primary', pending);
  }

  /** Zeigt den Fortschritt beim Erzeugen eines Zufallsrätsels (null = fertig). */
  setGenerating(fraction: number | null): void {
    this.randomBtn.disabled = fraction !== null;
    this.randomBtn.textContent = fraction === null ? 'Zufallsrätsel' : `Erzeuge… ${Math.round(fraction * 100)} %`;
  }

  /** Beschriftet den Button je nachdem, ob die Lösung gerade angezeigt wird. */
  setSolutionShown(shown: boolean): void {
    this.solveBtn.textContent = shown ? 'Lösung verbergen' : 'Lösung zeigen';
    this.solveBtn.classList.toggle('primary', shown);
    this.solveBtn.setAttribute('aria-pressed', String(shown));
  }

  setSolutionAvailable(available: boolean): void {
    this.solveBtn.disabled = !available;
  }

  setSolved(solved: boolean, showNumbers: boolean): void {
    this.showNums.disabled = !solved;
    this.showNums.checked = showNumbers;
  }

  setPuzzleInfo(p: Puzzle, clueCount: number): void {
    byId('iSize').textContent = `${p.width} × ${p.height} Felder`;
    byId('iClues').textContent = String(clueCount);
    byId('iAuthor').textContent = p.author || '–';
  }

  setSolveInfo(status: SolveStatus, logicSolvable: boolean, solutionFromFile: boolean): void {
    const text: Record<SolveStatus, string> = {
      pending: 'wird berechnet…',
      unique: logicSolvable ? 'eindeutig, ohne Raten lösbar' : 'eindeutig, braucht Ausprobieren',
      multiple: solutionFromFile ? 'mehrdeutig, Lösung aus Datei' : 'mehrdeutig – mehrere Lösungen',
      none: 'keine Lösung – Zahlen widersprüchlich',
      limit: 'zu komplex für die Prüfung'
    };
    this.solvInfo.textContent = text[status];
    this.solvInfo.className = status === 'unique' ? 'ok' : status === 'multiple' || status === 'none' ? 'warn' : '';
  }
}
