import { parsePuzzleText } from '../core/parser';
import type { ParsedFile } from '../core/types';

/** Speichert den aktuellen Stand verzögert im localStorage des Browsers. */
export class Autosave {
  private timer = 0;
  private pending: (() => string) | null = null;

  constructor(private readonly key: string, private readonly delayMs = 400) {
    // Beim Verlassen oder Neuladen der Seite ausstehende Änderungen sofort sichern
    window.addEventListener('pagehide', () => this.flush());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.flush(); });
  }

  schedule(getJson: () => string): void {
    this.pending = getJson;
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.flush(), this.delayMs);
  }

  /** Schreibt einen ausstehenden Stand sofort. */
  flush(): void {
    clearTimeout(this.timer);
    const get = this.pending;
    this.pending = null;
    if (!get) return;
    try { localStorage.setItem(this.key, get()); } catch { /* Speicher voll oder gesperrt */ }
  }

  restore(): ParsedFile | null {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? parsePuzzleText(raw) : null;
    } catch {
      return null;
    }
  }

  clear(): void {
    try { localStorage.removeItem(this.key); } catch { /* ignorieren */ }
  }
}
