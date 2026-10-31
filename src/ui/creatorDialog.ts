import { canReachLevel, compareLevels, type GenerateResult, type GeneratorLevel } from '../core/generator';
import { GeneratorClient } from '../core/generatorClient';
import { MOTIF_KINDS, generateMotif, motifLabel, type MotifKind } from '../core/motifs';
import { generateForLevel, puzzleFromPattern, type CreatedPuzzle, type RandomPuzzleOptions } from '../core/puzzleFactory';
import { newSeed } from '../core/random';
import { downloadPuzzleImages } from '../io/imageExport';
import { loadImageFile, sampleLuminance, type LoadedImage } from '../image/imageSampler';
import { containRect, fillRatio, otsuThreshold, smoothPattern, toPattern } from '../image/pattern';
import { LEVEL_NAMES } from './difficulty';
import { byId } from './dom';
import { readPalette } from './theme';

export const MIN_GRID = 5;
export const MAX_GRID = 80;
const DEFAULT_SIZE = 20;

type Source = 'motif' | 'image';

/**
 * Dialog „Rätsel erstellen“: Zufallsmotiv erzeugen oder Bild laden,
 * Raster einstellen, Vorschau per Klick nachbessern und Zahlen erzeugen lassen.
 */
export class CreatorDialog {
  private dlg = byId<HTMLDialogElement>('createDlg');
  private form = byId<HTMLFormElement>('createForm');
  private motifOpts = byId('cMotifOpts');
  private imageOpts = byId('cImageOpts');
  private kindIn = byId<HTMLSelectElement>('cKind');
  /** Eigener Text für das Motiv „Buchstaben“. */
  private textField = byId('cTextField');
  private textIn = byId<HTMLInputElement>('cText');
  private fileInput = byId<HTMLInputElement>('cImgInput');
  private imgName = byId('cImgName');
  private titleIn = byId<HTMLInputElement>('cTitle');
  /** Rätsel sind immer quadratisch: eine Zahl für Breite und Höhe. */
  private sizeIn = byId<HTMLInputElement>('cSize');
  private thrIn = byId<HTMLInputElement>('cThr');
  private thrVal = byId('cThrVal');
  private invIn = byId<HTMLInputElement>('cInv');
  private smoothIn = byId<HTMLInputElement>('cSmooth');
  private underlayIn = byId<HTMLInputElement>('cUnderlay');
  private levelIn = byId<HTMLSelectElement>('cLevel');
  private canvas = byId<HTMLCanvasElement>('cPreview');
  private previewBox = byId('cPreviewBox');
  private stats = byId('cStats');
  private msg = byId('cMsg');
  private progress = byId('cProgress');
  private createBtn = byId<HTMLButtonElement>('cCreate');
  private jpgBtn = byId<HTMLButtonElement>('cJpg');
  private playBtn = byId<HTMLButtonElement>('cPlay');
  /** Zuletzt erstelltes Rätsel; wird verworfen, sobald sich Raster oder Schwierigkeit ändern. */
  private created: CreatedPuzzle | null = null;
  /** Startwert des Motivs, das schon als Bild gespeichert wurde – es wird dann nicht mehr ausgetauscht. */
  private savedSeed: number | null = null;

  private generator = new GeneratorClient();
  private source: Source = 'motif';
  private img: LoadedImage | null = null;
  private lum: Float32Array | null = null;
  private motifSeed = newSeed();
  private motifKind: MotifKind = 'blobs';
  private cols = DEFAULT_SIZE;
  private rows = DEFAULT_SIZE;
  private pattern: Uint8Array = new Uint8Array(DEFAULT_SIZE * DEFAULT_SIZE);
  /** Manuelle Änderungen in der Vorschau: Index → 0/1. */
  private edits = new Map<number, number>();
  /** Bild-Modus: automatisch erzeugte Felder entfernt – nur das Bild dient als Vorlage. */
  private blank = false;
  private blankBtn = byId<HTMLButtonElement>('cBlank');
  private clearEditsBtn = byId<HTMLButtonElement>('cClearEdits');
  private cellPx = 16;
  private paintValue: number | null = null;
  private busy = false;
  private initialized = false;

  constructor(private readonly onCreate: (created: CreatedPuzzle) => void) {
    for (const { kind, label } of MOTIF_KINDS) this.kindIn.add(new Option(label, kind));

    document.querySelectorAll<HTMLInputElement>('input[name="cSrc"]').forEach(r =>
      r.addEventListener('change', () => this.setSource(r.value as Source)));
    this.kindIn.addEventListener('change', () => {
      this.textField.hidden = this.kindIn.value !== 'letters';
      this.newMotif();
    });
    this.textIn.addEventListener('input', () => {
      this.edits.clear();
      this.rebuild();
      this.setAutoTitle(this.motifTitle());
    });
    byId('cNewMotif').addEventListener('click', () => this.newMotif());

    byId('cImgBtn').addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', () => {
      const f = this.fileInput.files?.[0];
      if (f) void this.setImage(f);
      this.fileInput.value = '';
    });
    this.titleIn.addEventListener('input', () => { this.titleIn.dataset.auto = '0'; });
    this.sizeIn.addEventListener('change', () => this.onSizeChange());
    // Wer an Schwelle, Umkehrung oder Glättung dreht, möchte die automatischen Felder wieder sehen
    this.thrIn.addEventListener('input', () => { this.setBlank(false); this.rebuild(); });
    this.invIn.addEventListener('change', () => { this.setBlank(false); this.rebuild(); });
    this.smoothIn.addEventListener('change', () => { this.setBlank(false); this.rebuild(); });
    this.blankBtn.addEventListener('click', () => this.toggleBlank());
    this.underlayIn.addEventListener('change', () => this.draw());
    byId('cAuto').addEventListener('click', () => {
      if (!this.lum) return;
      this.thrIn.value = String(otsuThreshold(this.lum));
      this.setBlank(false);
      this.rebuild();
    });
    this.clearEditsBtn.addEventListener('click', () => {
      this.edits.clear();
      this.rebuild();
      this.say('');
    });
    this.levelIn.addEventListener('change', () => this.discardCreated());
    this.createBtn.addEventListener('click', () => void this.create());
    this.jpgBtn.addEventListener('click', () => void this.saveImages());
    this.playBtn.addEventListener('click', () => this.play());
    // Enter in einem Eingabefeld soll den Dialog nicht schließen
    this.form.addEventListener('submit', e => {
      if ((e.submitter as HTMLButtonElement | null)?.value !== 'cancel') e.preventDefault();
    });
    this.dlg.addEventListener('close', () => { if (this.busy) this.generator.cancel(); });

    this.canvas.addEventListener('pointerdown', e => this.onPointerDown(e));
    this.canvas.addEventListener('pointermove', e => this.onPointerMove(e));
    const stop = () => { this.paintValue = null; };
    this.canvas.addEventListener('pointerup', stop);
    this.canvas.addEventListener('pointercancel', stop);
  }

  /** Öffnet den Dialog; mit Datei direkt im Bild-Modus. */
  open(file?: File): void {
    if (!this.dlg.open) this.dlg.showModal();
    this.say('');
    if (!this.initialized) {
      this.initialized = true;
      this.newMotif();
    }
    if (file) {
      this.setSource('image');
      void this.setImage(file);
    } else this.draw();
  }

  get isOpen(): boolean { return this.dlg.open; }

  /** Einstellungen für ein Zufallsrätsel per Ein-Klick (Größe, Motiv, Schwierigkeit aus dem Dialog). */
  randomSettings(): Omit<RandomPuzzleOptions, 'onProgress' | 'seed'> {
    const size = this.clampSize(this.sizeIn);
    return {
      width: size,
      height: size,
      level: this.levelIn.value as GeneratorLevel,
      kind: this.kindIn.value as MotifKind | 'any',
      text: this.textIn.value
    };
  }

  /* ---------- Quelle ---------- */

  private setSource(source: Source): void {
    this.source = source;
    const radio = document.querySelector<HTMLInputElement>(`input[name="cSrc"][value="${source}"]`);
    if (radio) radio.checked = true;
    this.motifOpts.hidden = source !== 'motif';
    this.imageOpts.hidden = source !== 'image';
    this.blankBtn.hidden = source !== 'image';
    this.updateBlankButton();
    this.edits.clear();
    if (source === 'image') {
      if (this.img) this.onSizeChange(false, true);
      else { this.lum = null; this.rebuild(); }
      this.setAutoTitle(this.img ? this.img.name : '');
    } else {
      this.rebuild();
      this.setAutoTitle(this.motifTitle());
    }
  }

  private motifTitle(): string {
    const text = this.textIn.value.trim();
    if (this.motifKind === 'letters' && text) return text;
    return `${motifLabel(this.motifKind)} ${String(this.motifSeed % 10000).padStart(4, '0')}`;
  }

  private setAutoTitle(title: string): void {
    if (!this.titleIn.value.trim() || this.titleIn.dataset.auto !== '0') {
      this.titleIn.value = title;
      this.titleIn.dataset.auto = '1';
    }
  }

  private newMotif(): void {
    this.motifSeed = newSeed();
    this.edits.clear();
    if (this.source !== 'motif') this.setSource('motif');
    else this.rebuild();
    this.setAutoTitle(this.motifTitle());
    this.say('');
  }

  private async setImage(file: File): Promise<void> {
    try {
      const img = await loadImageFile(file);
      this.img?.dispose();
      this.img = img;
      this.imgName.textContent = `${file.name} (${img.width} × ${img.height} px)`;
      this.edits.clear();
      this.setBlank(false);
      this.onSizeChange(false, true);
      if (this.lum) this.thrIn.value = String(otsuThreshold(this.lum));
      this.rebuild();
      this.setAutoTitle(img.name);
      this.say('');
    } catch (e) {
      this.say((e as Error).message, true);
    }
  }

  /* ---------- Größe & Raster ---------- */

  private clampSize(input: HTMLInputElement): number {
    const v = Math.round(Number(input.value));
    const clamped = Number.isFinite(v) ? Math.max(MIN_GRID, Math.min(MAX_GRID, v)) : DEFAULT_SIZE;
    input.value = String(clamped);
    return clamped;
  }

  private onSizeChange(announce = true, force = false): void {
    const cols = this.clampSize(this.sizeIn), rows = cols;
    if (!force && cols === this.cols && rows === this.rows) return;
    const hadEdits = this.edits.size > 0;
    this.cols = cols;
    this.rows = rows;
    this.edits.clear();
    this.lum = this.source === 'image' && this.img ? sampleLuminance(this.img, cols, rows) : null;
    this.rebuild();
    if (announce && hadEdits) this.say('Die Rastergröße hat sich geändert, deine Änderungen in der Vorschau wurden verworfen.');
  }

  /** Berechnet das Raster aus Motiv bzw. Bild, Optionen und manuellen Änderungen. */
  private rebuild(): void {
    this.thrVal.textContent = this.thrIn.value;
    const n = this.cols * this.rows;
    let p: Uint8Array;
    if (this.source === 'motif') {
      const motif = generateMotif(this.kindIn.value as MotifKind | 'any', this.cols, this.rows, this.motifSeed,
        { text: this.textIn.value });
      this.motifKind = motif.kind;
      p = Uint8Array.from(motif.pattern);
    } else if (this.lum && !this.blank) {
      p = toPattern(this.lum, Number(this.thrIn.value), this.invIn.checked);
      if (this.smoothIn.checked) p = smoothPattern(p, this.cols, this.rows);
    } else {
      p = new Uint8Array(n);
    }
    for (const [i, v] of this.edits) if (i < n) p[i] = v;
    this.pattern = p;
    this.discardCreated();
    this.updateStats();
    this.draw();
  }

  private updateStats(): void {
    const pct = Math.round(fillRatio(this.pattern) * 100);
    const edits = this.edits.size ? `, ${this.edits.size} von Hand geändert` : '';
    const blank = this.source === 'image' && this.blank ? ', automatische Felder entfernt' : '';
    this.stats.textContent = `${this.cols} × ${this.rows} Felder, ${pct} % gefüllt${edits}${blank}`;
    // Verwerfen gibt es nur, wenn es Handänderungen gibt
    this.clearEditsBtn.hidden = this.edits.size === 0;
  }

  /* ---------- Leeres Raster mit Bild als Vorlage ---------- */

  private setBlank(blank: boolean): void {
    this.blank = blank;
    this.updateBlankButton();
  }

  private updateBlankButton(): void {
    this.blankBtn.disabled = this.busy || !this.img;
    this.blankBtn.textContent = this.blank ? 'Automatische Felder wiederherstellen' : 'Automatische Felder entfernen';
    this.blankBtn.setAttribute('aria-pressed', String(this.blank));
  }

  /**
   * Entfernt die automatisch erzeugten Felder (Bild bleibt als Vorlage sichtbar) bzw. stellt
   * sie wieder her. Handänderungen bleiben in beiden Richtungen erhalten.
   */
  private toggleBlank(): void {
    if (!this.img) return;
    if (this.blank) {
      this.setBlank(false);
      this.rebuild();
      this.say('Die automatisch erzeugten Felder sind wieder da. Deine Handänderungen bleiben erhalten.');
      return;
    }
    this.setBlank(true);
    this.underlayIn.checked = true;
    this.rebuild();
    this.say(this.edits.size
      ? 'Die automatischen Felder sind entfernt, deine Handänderungen bleiben erhalten. Das Bild dient als Vorlage.'
      : 'Das Raster ist leer, das Bild dient als Vorlage. Klicke oder ziehe in der Vorschau, um Felder zu füllen.');
  }

  private say(text: string, error = false): void {
    this.msg.textContent = text;
    this.msg.classList.toggle('info', !error);
  }

  /* ---------- Vorschau ---------- */

  private draw(): void {
    if (!this.dlg.open) return;
    const P = readPalette();
    const boxW = Math.max(160, this.previewBox.clientWidth - 4);
    const maxH = Math.max(200, Math.min(520, window.innerHeight * 0.55));
    this.cellPx = Math.max(3, Math.floor(Math.min(boxW / this.cols, maxH / this.rows)));
    const cs = this.cellPx, w = this.cols * cs, h = this.rows * cs;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = P.cell;
    ctx.fillRect(0, 0, w, h);

    const underlay = this.source === 'image' && this.img && this.underlayIn.checked;
    if (underlay && this.img) {
      ctx.globalAlpha = 0.45;
      // Wie beim Abtasten: unverzerrt und mittig
      const r = containRect(this.img.width, this.img.height, w, h);
      ctx.drawImage(this.img.image, r.x, r.y, r.w, r.h);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = P.fill;
    ctx.globalAlpha = underlay ? 0.82 : 1;
    for (let i = 0; i < this.pattern.length; i++) {
      if (this.pattern[i]) ctx.fillRect((i % this.cols) * cs, Math.floor(i / this.cols) * cs, cs, cs);
    }
    ctx.globalAlpha = 1;

    if (cs >= 6) {
      ctx.fillStyle = P.line;
      ctx.globalAlpha = 0.7;
      for (let x = 1; x < this.cols; x++) ctx.fillRect(x * cs - 0.5, 0, 1, h);
      for (let y = 1; y < this.rows; y++) ctx.fillRect(0, y * cs - 0.5, w, 1);
      ctx.globalAlpha = 1;
    }
    // Von Hand geänderte Felder mit kleinem Punkt markieren
    if (cs >= 8) {
      ctx.fillStyle = P.accent;
      const r = Math.max(1.5, cs * 0.12);
      for (const i of this.edits.keys()) {
        const x = (i % this.cols) * cs + cs - r - 2, y = Math.floor(i / this.cols) * cs + r + 2;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.strokeStyle = P.lineStrong;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
  }

  private cellAt(e: PointerEvent): number {
    const r = this.canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / this.cellPx);
    const y = Math.floor((e.clientY - r.top) / this.cellPx);
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return -1;
    return y * this.cols + x;
  }

  private onPointerDown(e: PointerEvent): void {
    if (this.busy) return;
    const i = this.cellAt(e);
    if (i < 0) return;
    e.preventDefault();
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignorieren */ }
    this.paintValue = this.pattern[i] ? 0 : 1;
    this.paintCell(i);
  }

  private onPointerMove(e: PointerEvent): void {
    if (this.paintValue === null) return;
    const i = this.cellAt(e);
    if (i >= 0 && this.pattern[i] !== this.paintValue) this.paintCell(i);
  }

  private paintCell(i: number): void {
    this.edits.set(i, this.paintValue!);
    this.pattern[i] = this.paintValue!;
    this.discardCreated();
    this.updateStats();
    this.draw();
  }

  /* ---------- Erzeugen ---------- */

  private setBusy(busy: boolean): void {
    this.busy = busy;
    this.form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('input, select, button')
      .forEach(el => { if (el.value !== 'cancel') el.disabled = busy; });
    this.progress.hidden = !busy;
    this.updateBlankButton();
    this.updateActions();
    this.createBtn.textContent = busy ? 'Wird erstellt…' : 'Rätsel erstellen';
  }

  /** Speichern und Spielen gibt es erst, wenn ein Rätsel zum aktuellen Raster erstellt ist. */
  private updateActions(): void {
    const ready = !this.busy && this.created !== null;
    this.jpgBtn.disabled = !ready;
    this.playBtn.disabled = !ready;
    this.playBtn.classList.toggle('primary', this.created !== null);
    this.createBtn.classList.toggle('primary', this.created === null);
  }

  /** Raster oder Schwierigkeit geändert: Das erstellte Rätsel passt nicht mehr. */
  private discardCreated(): void {
    if (!this.created) return;
    this.created = null;
    this.updateActions();
    this.say('Das Raster oder die Schwierigkeit hat sich geändert. Klicke „Rätsel erstellen“, um die Zahlen neu festzulegen.');
  }

  /** Das erstellte Rätsel mit dem aktuellen Titel (der Titel darf sich nach dem Erstellen noch ändern). */
  private currentCreated(): CreatedPuzzle | null {
    if (!this.created) return null;
    this.created.parsed.puzzle.title = this.titleIn.value.trim() || 'Eigenes Motiv';
    return this.created;
  }

/**
   * Erzeugt aus dem aktuellen Raster ein Rätsel in der gewählten Stufe (mit Fortschrittsanzeige).
   * Fällt das Ergebnis zu leicht aus, werden weitere Zahlen-Verteilungen versucht.
   * Lässt sich das Motiv nicht so leicht machen wie gewünscht und ist allowNewMotif gesetzt,
   * wird bei unveränderten Zufallsmotiven ein anderes Motiv gewählt (die Vorschau zeigt es).
   * Liefert null bei leerem Raster, mehrdeutigem Ergebnis oder Abbruch.
   */
  private async generate(allowNewMotif: boolean): Promise<CreatedPuzzle | null> {
    if (!fillRatio(this.pattern)) {
      this.say('Das Raster ist leer. Erzeuge ein Motiv, wähle ein Bild oder zeichne Felder in der Vorschau.', true);
      return null;
    }
    const level = this.levelIn.value as GeneratorLevel;
    const bar = this.progress.firstElementChild as HTMLElement;
    bar.style.width = '0%';
    this.say('');
    const MAX_MOTIFS = 8;
    let replaced = 0;
    const mayReplace = allowNewMotif && this.source === 'motif' && this.edits.size === 0;
    // Schneller Vorab-Test: Motiv durch ein passendes ersetzen, falls es die Stufe gar nicht erreichen kann
    for (let k = 0; mayReplace && k < 40 && !canReachLevel(this.cols, this.rows, this.pattern, level); k++) {
      this.motifSeed = newSeed();
      this.rebuild();
      replaced++;
    }
    if (replaced) this.setAutoTitle(this.motifTitle());
    let result: GenerateResult;
    for (let attempt = 1; ; attempt++) {
      const pattern = Uint8Array.from(this.pattern);
      result = await generateForLevel(this.generator, this.cols, this.rows, pattern, level,
        f => { bar.style.width = `${Math.round(((attempt - 1 + f) / attempt) * 100)}%`; });
      const fits = result.quality === 'logic' && compareLevels(result.level, level) === 0;
      const canSwap = mayReplace && attempt < MAX_MOTIFS;
      if (fits || !canSwap) break;
      // Motiv passt nicht zur Stufe: anderes Motiv derselben Art versuchen
      this.motifSeed = newSeed();
      this.rebuild();
      this.setAutoTitle(this.motifTitle());
      replaced++;
    }
    if (result.quality === 'ambiguous') {
      this.say(this.source === 'motif'
        ? 'Dieses Motiv hat mehrere Lösungen. Erzeuge ein neues Motiv oder ändere einzelne Felder.'
        : 'Dieses Raster hat mehrere Lösungen und ergibt kein eindeutiges Rätsel. Ändere Schwelle, Größe oder einzelne Felder.', true);
      return null;
    }
    const title = this.titleIn.value.trim() || 'Eigenes Motiv';
    const source = this.source === 'motif'
      ? `Zufallsmotiv (${this.motifKind}, Startwert ${this.motifSeed})`
      : 'Mit dem Mosaik-Ersteller aus einem Bild erzeugt';
    const note = replaced
      ? ` Das zuerst gezeigte Motiv ließ sich nicht als „${LEVEL_NAMES[level]}“ lösen, deshalb wurde ein anderes verwendet.`
      : undefined;
    return { parsed: puzzleFromPattern(this.cols, this.rows, Uint8Array.from(this.pattern), result, title, source), result, note };
  }

  /** Nach dem Spielen eines Zufallsmotivs für das nächste Öffnen ein frisches bereitstellen. */
  private prepareNextMotif(): void {
    if (this.source !== 'motif') return;
    this.motifSeed = newSeed();
    this.edits.clear();
    this.titleIn.dataset.auto = '1';
    this.rebuild();
    this.setAutoTitle(this.motifTitle());
  }

  private async run(task: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.setBusy(true);
    try {
      await task();
    } catch (e) {
      if ((e as Error).message !== 'abgebrochen') this.say(`Fehler: ${(e as Error).message}`, true);
    } finally {
      this.setBusy(false);
    }
  }

  /**
   * Erzeugt das Rätsel zum aktuellen Raster. Danach lässt es sich als Bild speichern und/oder spielen.
   * Ein Motiv, das schon als Bild gespeichert wurde, wird nicht mehr ausgetauscht,
   * damit es sich in weiteren Stufen speichern lässt.
   */
  private create(): Promise<void> {
    return this.run(async () => {
      this.created = null;
      const created = await this.generate(this.savedSeed !== this.motifSeed);
      if (!created) return;
      this.created = created;
      const { result } = created;
      const difficulty = result.quality === 'logic' ? result.level : null;
      const comparisons = result.comparisons === 1 ? '1 Vergleich' : `${result.comparisons} Vergleiche`;
      const level = difficulty ? `Stufe ${LEVEL_NAMES[difficulty]}, ${comparisons}` : 'braucht Ausprobieren';
      const requested = this.levelIn.value as GeneratorLevel;
      const mismatch = difficulty && difficulty !== requested
        ? ` Achtung: gewünscht war „${LEVEL_NAMES[requested]}“, dieses Motiv ergibt „${LEVEL_NAMES[difficulty]}“.`
        : '';
      this.say(`Rätsel erstellt: ${result.clueCount} Zahlen, ${level}.${created.note ?? ''}${mismatch}`, !!mismatch);
    });
  }

  /** Speichert Aufgabe und Lösung des erstellten Rätsels als JPG. Dialog und Motiv bleiben bestehen. */
  private saveImages(): Promise<void> {
    return this.run(async () => {
      const created = this.currentCreated();
      if (!created) return;
      const { parsed, result } = created;
      const difficulty = result.quality === 'logic' ? result.level : null;
      const names = await downloadPuzzleImages(parsed.puzzle, parsed.puzzle.solution,
        difficulty ? { level: difficulty, comparisons: result.comparisons } : null);
      if (this.source === 'motif') this.savedSeed = this.motifSeed;
      const next = this.source === 'motif' ? ' Für ein anderes Motiv klicke „Neues Motiv“.' : '';
      const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} und ${names[names.length - 1]}` : names[0];
      this.say(`Gespeichert: ${list}.${next}`);
    });
  }

  /** Lädt das erstellte Rätsel ins Spielfeld und schließt den Dialog. */
  private play(): void {
    const created = this.currentCreated();
    if (!created || this.busy) return;
    this.created = null;
    this.updateActions();
    this.dlg.close();
    this.onCreate(created);
    this.prepareNextMotif();
  }
}
