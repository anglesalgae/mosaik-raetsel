import { byId } from './dom';

export interface JsonDialogActions {
  /** Lädt den Text; wirft bei Fehlern (Meldung wird im Dialog angezeigt). */
  load(text: string): void;
  currentJson(): string | null;
  copy(text: string): Promise<boolean>;
}

/** Dialog zum Einfügen oder Kopieren eines Rätsels als JSON-Text. */
export class JsonDialog {
  private dlg = byId<HTMLDialogElement>('jsonDlg');
  private text = byId<HTMLTextAreaElement>('jsonText');
  private msg = byId('jsonMsg');

  constructor(actions: JsonDialogActions, onInfo: (text: string) => void) {
    byId('jsonCurrent').addEventListener('click', () => {
      const json = actions.currentJson();
      if (json) this.text.value = json;
      this.msg.textContent = '';
    });
    byId('jsonCopy').addEventListener('click', async () => {
      if (await actions.copy(this.text.value)) { this.msg.textContent = ''; onInfo('Text kopiert.'); }
      else { this.text.select(); this.msg.textContent = 'Kopieren nicht möglich – bitte Text markieren und manuell kopieren.'; }
    });
    byId('jsonLoad').addEventListener('click', () => {
      try {
        actions.load(this.text.value);
        this.dlg.close();
      } catch (e) {
        this.msg.textContent = (e as Error).message;
      }
    });
  }

  open(): void {
    this.msg.textContent = '';
    this.dlg.showModal();
    this.text.focus();
  }
}

/** Dialog mit Beschreibung des Dateiformats und Vorlage zum Speichern. */
export class FormatDialog {
  private dlg = byId<HTMLDialogElement>('formatDlg');

  constructor(exampleJson: string, onSaveTemplate: () => void) {
    byId('fmtExample').textContent = exampleJson;
    byId('fmtSave').addEventListener('click', onSaveTemplate);
  }

  open(): void {
    this.dlg.showModal();
  }
}
