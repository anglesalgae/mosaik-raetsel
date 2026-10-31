import { Game } from './core/game';
import { nextHint } from './core/hints';
import { FormatError, parsePuzzleObject, parsePuzzleText } from './core/parser';
import { fileNameFor, toJson, toSaveFile } from './core/serializer';
import { classifyPuzzle, isDeadly, isGeneratorLevel, type GeneratorLevel } from './core/generator';
import { GeneratorClient } from './core/generatorClient';
import { createRandomPuzzle, type CreatedPuzzle } from './core/puzzleFactory';
import { SolverClient } from './core/solverClient';
import { Cell, type CellState, type DecidedState, type ParsedFile, type SaveFile } from './core/types';
import { EXAMPLE_PUZZLE, TEMPLATE_PUZZLE } from './data/examples';
import { Autosave } from './io/autosave';
import { setupDropZone } from './io/dropZone';
import { copyText, downloadText, readPuzzleFile } from './io/files';
import { BoardInput } from './ui/boardInput';
import { BoardView } from './ui/boardView';
import { CreatorDialog } from './ui/creatorDialog';
import { LEVEL_NAMES } from './ui/difficulty';
import { FormatDialog, JsonDialog } from './ui/dialogs';
import { byId, formatTime } from './ui/dom';
import { Header } from './ui/header';
import { Sidebar } from './ui/sidebar';
import { StatusBar } from './ui/statusBar';
import { watchTheme } from './ui/theme';
import { createViewState } from './ui/viewState';

const STORAGE_KEY = 'mosaik.v1.current';

/** Verbindet Spielzustand, Löser und Oberflächenkomponenten. */
export class App {
  private game = new Game();
  private view = createViewState();
  private solver = new SolverClient();
  private generator = new GeneratorClient();
  private generating = false;
  private autosave = new Autosave(STORAGE_KEY);
  private status = new StatusBar();
  private header: Header;
  private sidebar: Sidebar;
  private board: BoardView;
  private jsonDialog: JsonDialog;
  private formatDialog: FormatDialog;
  private creator: CreatorDialog;
  /** Hinweis, der beim nächsten Klick auf „Hinweis“ angewendet wird. */
  private pendingStep: { cells: number[]; value: DecidedState } | null = null;

  constructor() {
    const stage = byId('stage');
    this.board = new BoardView(byId<HTMLCanvasElement>('board'), stage, this.game, this.view);
    this.header = new Header({ undo: () => this.undo(), redo: () => this.redo() });
    this.sidebar = new Sidebar({
      openFile: f => void this.openFile(f),
      save: () => this.save(),
      openJsonDialog: () => this.jsonDialog.open(),
      openFormatDialog: () => this.formatDialog.open(),
      openCreator: () => this.creator.open(),
      randomPuzzle: () => void this.randomPuzzle(),
      loadExample: () => this.loadParsed(parsePuzzleObject(EXAMPLE_PUZZLE), 'Beispielrätsel geladen.'),
      setTool: t => this.setTool(t),
      hint: () => this.hint(),
      check: () => this.check(),
      toggleSolution: () => this.toggleSolution(),
      reset: () => this.reset(),
      setLiveErrors: on => this.setLiveErrors(on),
      setZoom: z => { this.view.zoom = z; this.board.layout(); },
      setShowNumbers: on => { this.view.showNumbers = on; this.board.requestDraw(); }
    });
    this.jsonDialog = new JsonDialog({
      load: text => this.loadParsed(parsePuzzleText(text), 'Rätsel aus Text geladen.'),
      currentJson: () => (this.game.loaded ? toJson(this.currentSaveFile()) : null),
      copy: copyText
    }, text => this.status.show(text, 'success'));
    this.formatDialog = new FormatDialog(toJson(TEMPLATE_PUZZLE), () => {
      downloadText('mosaik-vorlage.json', toJson(TEMPLATE_PUZZLE));
      this.status.show('Vorlage gespeichert als mosaik-vorlage.json.', 'success');
    });
    this.creator = new CreatorDialog(r => this.onCreated(r));
    new BoardInput(this.board, this.game, this.view, {
      canEdit: () => {
        if (!this.view.showSolution) return true;
        this.status.show('Die Lösung wird gerade angezeigt. Klicke „Lösung verbergen“, um weiterzuspielen.');
        return false;
      },
      beforeEdit: () => this.clearMarks(),
      hint: () => this.hint(),
      save: () => this.save(),
      setTool: t => this.setTool(t)
    });
    setupDropZone(stage, f => void this.openFile(f));
    watchTheme(() => this.board.refreshPalette());
    document.fonts?.ready.then(() => this.board.requestDraw());

    this.bindGameEvents();
    this.startClock();
    this.restoreOrLoadExample();
  }

  /* ---------- Spiel-Events → Oberfläche ---------- */

  private bindGameEvents(): void {
    const g = this.game;
    g.on('load', ({ fromProgress }) => {
      this.view.marks = null;
      this.view.checkedErrors = null;
      this.view.cursor = -1;
      this.view.hover = -1;
      this.view.showNumbers = !g.solved;
      this.view.reveal = g.solved ? 1 : 0;
      this.pendingStep = null;
      this.sidebar.setHintPending(false);
      this.hideSolution();
      this.header.setPuzzle(g.puzzle.title, g.width, g.height);
      this.header.setNote(this.storedSummary());
      this.showDifficulty();
      this.sidebar.setPuzzleInfo(g.puzzle, g.model.clueCells.length);
      this.sidebar.setSolveInfo('pending', false, false);
      this.refresh();
      this.board.layout();
      void this.computeSolution();
      if (fromProgress && g.solved) this.status.show('Dieses Rätsel ist bereits gelöst.', 'success');
    });
    g.on('change', () => this.refresh());
    g.on('solution', ({ status, note }) => {
      this.sidebar.setSolveInfo(status, g.logicSolvable, !!g.puzzle.solution && g.solution === g.puzzle.solution);
      if (note) this.status.show(note, 'error');
      this.refresh();
    });
    g.on('solved', ({ elapsedSeconds }) => {
      this.view.showNumbers = false;
      this.status.show(`Gelöst! „${g.puzzle.title}“ in ${formatTime(elapsedSeconds)}. Ein neues gibt es mit „Zufallsrätsel“.`, 'success');
      this.refresh();
      this.board.playReveal();
    });
    g.on('tick', ({ elapsedSeconds }) => {
      this.header.setTime(elapsedSeconds);
      if (elapsedSeconds % 15 === 0) this.scheduleAutosave();
    });
  }

  private refresh(): void {
    const g = this.game;
    if (!g.solved) { this.view.reveal = 0; this.view.showNumbers = true; }
    byId('frame').classList.toggle('solved', g.solved);
    this.header.setProgress(g.progress());
    this.header.setTime(g.elapsedSeconds);
    this.header.setHistory(g.canUndo, g.canRedo);
    this.sidebar.setSolutionAvailable(!!g.solution);
    this.sidebar.setSolved(g.solved, this.view.showNumbers);
    this.scheduleAutosave();
    this.board.requestDraw();
  }

  /**
   * Angaben für die Kopfzeile aus den in der Datei gespeicherten Werten (Stufe, Zahlen, Vergleiche),
   * damit sie nach dem Laden genauso erscheinen wie nach dem Erstellen. null, wenn sie fehlen.
   */
  private storedSummary(): string | null {
    const { puzzle, model } = this.game;
    const { difficulty, clueCount, comparisons } = puzzle.extra;
    if (!isGeneratorLevel(difficulty) || typeof comparisons !== 'number') return null;
    const clues = typeof clueCount === 'number' ? clueCount : model.clueCells.length;
    const needed = comparisons ? `, ${comparisons === 1 ? '1 Vergleich' : `${comparisons} Vergleiche`} nötig` : '';
    return `„${puzzle.title}“: ${puzzle.width} × ${puzzle.height}, ${clues} Zahlen, ohne Raten lösbar. Stufe ${LEVEL_NAMES[difficulty]}${needed}.`;
  }

  /** Schwierigkeit in der Titelzeile: aus der Datei, sonst aus den Zahlen bestimmt. */
  private showDifficulty(): void {
    const g = this.game;
    const stored = g.puzzle.extra.difficulty;
    const storedComparisons = g.puzzle.extra.comparisons;
    const clueCount = g.model.clueCells.length;
    if (isGeneratorLevel(stored) && typeof storedComparisons === 'number') {
      this.header.setDifficulty(stored, isDeadly(storedComparisons, clueCount));
      return;
    }
    // Ohne gespeicherte Vergleiche: Stufe aus der Datei zeigen, Vergleiche nachrechnen
    this.header.setDifficulty(isGeneratorLevel(stored) ? stored : null);
    const puzzle = g.puzzle;
    // Etwas später berechnen, damit das Spielfeld sofort erscheint
    setTimeout(() => {
      if (g.puzzle !== puzzle) return;
      const found = classifyPuzzle(puzzle.width, puzzle.height, puzzle.clues);
      const level = isGeneratorLevel(stored) ? stored : found?.level ?? null;
      this.header.setDifficulty(level, !!found && isDeadly(found.comparisons, clueCount));
    }, 30);
  }

  private async computeSolution(): Promise<void> {
    const outcome = await this.solver.solve(this.game.puzzle);
    if (outcome) this.game.applySolveOutcome(outcome);
  }

  private startClock(): void {
    window.setInterval(() => {
      // Während die Lösung angezeigt wird, läuft die Zeit nicht weiter
      if (document.visibilityState === 'visible' && !this.view.showSolution) this.game.tick();
    }, 1000);
  }

  /* ---------- Laden & Speichern ---------- */

  private loadParsed(parsed: ParsedFile, message: string | null): void {
    this.game.load(parsed);
    if (message) {
      this.status.show(parsed.progress ? `${message} Gespeicherter Stand wurde übernommen.` : message);
    }
  }

  private async openFile(file: File): Promise<void> {
    if (file.type.startsWith('image/')) {
      this.creator.open(file);
      return;
    }
    if (this.creator.isOpen) {
      this.status.show('Im Ersteller kannst du nur Bilder ablegen.', 'error');
      return;
    }
    try {
      this.loadParsed(await readPuzzleFile(file), `„${file.name}“ geladen.`);
    } catch (e) {
      const msg = e instanceof FormatError ? e.message : `Unerwarteter Fehler: ${(e as Error).message}`;
      this.status.show(`„${file.name}“ konnte nicht geladen werden: ${msg}`, 'error');
    }
  }

  private onCreated({ parsed, result, note }: CreatedPuzzle): void {
    const { width, height } = parsed.puzzle;
    const how = result.quality === 'logic' ? 'ohne Raten lösbar' : 'eindeutig, braucht aber Ausprobieren';
    const levelNames = LEVEL_NAMES;
    const comparisons = result.comparisons === 1 ? '1 Vergleich' : `${result.comparisons} Vergleiche`;
    let levelNote = result.quality !== 'logic' ? ''
      : result.comparisons ? ` Stufe ${levelNames[result.level]}, ${comparisons} nötig.` : ` Stufe ${levelNames[result.level]}.`;
    const order: GeneratorLevel[] = ['easy', 'moderate', 'medium'];
    if (result.quality === 'logic' && result.level !== result.requestedLevel) {
      levelNote += order.indexOf(result.level) > order.indexOf(result.requestedLevel)
        ? ` Mit „${levelNames[result.requestedLevel]}“ war dieses Motiv nicht lösbar.`
        : ` Schwerer als „${levelNames[result.level]}“ ließ sich dieses Motiv nicht machen.`;
    }
    if (note) levelNote += note;
    this.loadParsed(parsed, null);
    // Bleibt in der Kopfzeile stehen, solange das Rätsel geladen ist
    this.header.setNote(`„${parsed.puzzle.title}“ erstellt: ${width} × ${height}, ${result.clueCount} Zahlen, ${how}.${levelNote}`);
    this.status.show('');
  }

  /** Erzeugt mit einem Klick ein neues Rätsel (Einstellungen aus dem Ersteller). */
  private async randomPuzzle(): Promise<void> {
    if (this.generating) return;
    this.generating = true;
    const settings = this.creator.randomSettings();
    this.sidebar.setGenerating(0);
    this.status.show(`Erzeuge ein neues ${settings.width} × ${settings.height}-Rätsel…`);
    try {
      const created = await createRandomPuzzle(this.generator, {
        ...settings,
        onProgress: f => this.sidebar.setGenerating(f)
      });
      this.onCreated(created);
    } catch (e) {
      if ((e as Error).message !== 'abgebrochen') this.status.show(`Fehler beim Erzeugen: ${(e as Error).message}`, 'error');
    } finally {
      this.generating = false;
      this.sidebar.setGenerating(null);
    }
  }

  private currentSaveFile(): SaveFile {
    const g = this.game;
    return toSaveFile({ puzzle: g.puzzle, cells: g.cells, elapsedSeconds: g.elapsedSeconds, solved: g.solved });
  }

  private save(): void {
    if (!this.game.loaded) return;
    const name = fileNameFor(this.game.puzzle.title);
    downloadText(name, toJson(this.currentSaveFile()));
    this.status.show(`Gespeichert als ${name}.`, 'success');
  }

  private scheduleAutosave(): void {
    if (this.game.loaded) this.autosave.schedule(() => JSON.stringify(this.currentSaveFile()));
  }

  private restoreOrLoadExample(): void {
    const restored = this.autosave.restore();
    if (restored) {
      this.loadParsed(restored, null);
      this.status.show(`Weiter mit „${this.game.puzzle.title}“ – dein letzter Stand wurde wiederhergestellt.`);
    } else {
      this.loadParsed(parsePuzzleObject(EXAMPLE_PUZZLE), null);
      this.status.show('Fülle Felder so, dass jede Zahl angibt, wie viele Felder in ihrem 3×3-Block (sie selbst eingeschlossen) gefüllt sind.');
    }
  }

  /* ---------- Aktionen ---------- */

  private clearMarks(): void {
    this.view.marks = null;
    this.view.checkedErrors = null;
    if (this.pendingStep) { this.pendingStep = null; this.sidebar.setHintPending(false); }
  }

  private undo(): void { this.hideSolution(); this.clearMarks(); this.game.undo(); }
  private redo(): void { this.hideSolution(); this.clearMarks(); this.game.redo(); }

  private setTool(tool: CellState): void {
    this.view.tool = tool;
    this.sidebar.setTool(tool);
  }

  private hint(): void {
    if (!this.game.loaded) return;
    this.hideSolution();
    const step = this.pendingStep;
    if (step) {
      this.clearMarks();
      const n = this.game.set(step.cells, step.value).length;
      // Beim letzten Schritt bleibt die „Gelöst!“-Meldung stehen
      if (!this.game.solved) this.status.show(`Hinweis angewendet: ${n} ${n === 1 ? 'Feld' : 'Felder'} ${step.value === Cell.Filled ? 'gefüllt' : 'als leer markiert'}.`);
      return;
    }
    const h = nextHint(this.game);
    this.clearMarks();
    switch (h.kind) {
      case 'step':
        this.view.marks = { cells: h.cells, clues: h.clues, error: false };
        this.pendingStep = { cells: h.cells, value: h.value };
        this.sidebar.setHintPending(true);
        this.status.show(h.message);
        break;
      case 'mistakes':
        this.view.marks = { cells: h.cells, clues: [], error: true };
        this.status.show(h.message, 'error');
        break;
      case 'contradiction':
        this.view.marks = { cells: [], clues: h.clues, error: true };
        this.status.show(h.message, 'error');
        break;
      case 'none':
        this.status.show(h.message, this.game.solved ? 'success' : 'info');
    }
    this.board.requestDraw();
  }

  private check(): void {
    const g = this.game;
    if (!g.loaded) return;
    this.hideSolution();
    this.clearMarks();
    if (g.solution) {
      const wrong = g.wrongCells();
      this.view.checkedErrors = wrong;
      if (wrong.length) this.status.show(`${wrong.length === 1 ? 'Ein Feld ist' : `${wrong.length} Felder sind`} falsch (rot markiert).`, 'error');
      else this.status.show(g.solved ? 'Alles richtig – gelöst!' : 'Bisher ist alles richtig.', 'success');
    } else {
      const bad = [...g.clueStatuses()].filter(([, s]) => s === 2).map(([c]) => c);
      if (bad.length) {
        this.view.marks = { cells: [], clues: bad, error: true };
        this.status.show(`${bad.length} ${bad.length === 1 ? 'Zahl passt' : 'Zahlen passen'} nicht mehr (rot).`, 'error');
      } else {
        this.status.show(g.solveStatus === 'pending'
          ? 'Die Lösung wird noch berechnet – bisher keine Widersprüche.'
          : 'Keine Widersprüche gefunden. Eine eindeutige Lösung ist nicht bekannt, deshalb wird nur auf Widersprüche geprüft.');
      }
    }
    this.board.requestDraw();
  }

  /** Blendet die Lösung ein bzw. wieder aus. Der Spielstand bleibt dabei unverändert. */
  private toggleSolution(): void {
    if (this.view.showSolution) {
      this.hideSolution();
      this.status.show('Lösung ausgeblendet – dein Stand ist wieder zu sehen.');
      return;
    }
    if (!this.game.solution) { this.status.show('Für dieses Rätsel ist keine eindeutige Lösung bekannt.', 'error'); return; }
    this.clearMarks();
    this.view.showSolution = true;
    this.sidebar.setSolutionShown(true);
    byId('frame').classList.add('preview');
    this.status.show('Die Lösung wird angezeigt. Dein Stand bleibt erhalten – mit „Lösung verbergen“ geht es weiter.');
    this.board.requestDraw();
  }

  /** Beendet die Lösungsansicht (ohne Meldung). */
  private hideSolution(): void {
    if (!this.view.showSolution) return;
    this.view.showSolution = false;
    this.sidebar.setSolutionShown(false);
    byId('frame').classList.remove('preview');
    this.board.requestDraw();
  }


  private reset(): void {
    if (!this.game.loaded) return;
    this.hideSolution();
    this.clearMarks();
    const n = this.game.reset();
    this.status.show(n ? 'Zurückgesetzt. „Rückgängig“ holt den Stand zurück.' : 'Das Spielfeld ist bereits leer.');
  }

  private setLiveErrors(on: boolean): void {
    this.view.liveErrors = on;
    if (on && !this.game.solution) this.status.show('Ohne bekannte Lösung können keine Fehler markiert werden.');
    this.board.requestDraw();
  }
}
