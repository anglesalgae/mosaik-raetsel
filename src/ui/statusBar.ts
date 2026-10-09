import { byId } from './dom';

export type StatusKind = 'info' | 'error' | 'success';

/** Meldungszeile unter dem Spielfeld (wird von Screenreadern vorgelesen). */
export class StatusBar {
  private el = byId('status');

  show(text: string, kind: StatusKind = 'info'): void {
    this.el.textContent = text;
    this.el.className = 'status' + (kind === 'error' ? ' err' : kind === 'success' ? ' good' : '');
  }
}
