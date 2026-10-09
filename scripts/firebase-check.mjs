// Prüft vor dem Veröffentlichen, ob ein Firebase-Projekt verknüpft ist,
// und erklärt andernfalls die nötigen Schritte.
import { existsSync, readFileSync } from 'node:fs';

const file = new URL('../.firebaserc', import.meta.url);
let projectId = null;
if (existsSync(file)) {
  try {
    projectId = JSON.parse(readFileSync(file, 'utf8'))?.projects?.default ?? null;
  } catch {
    projectId = null;
  }
}

if (!projectId) {
  console.error(`
Es ist noch kein Firebase-Projekt verknüpft. Einmalig einrichten:

  1. Unter https://console.firebase.google.com ein Projekt anlegen
     und dort unter „Build → Hosting“ auf „Jetzt starten“ klicken.
  2. npm run firebase:login     (im Browser mit dem Google-Konto anmelden)
  3. npm run firebase:setup     (Projekt auswählen, als Alias „default“ eingeben)

Danach veröffentlichst du mit:  npm run deploy

Ausführliche Anleitung: README.md, Abschnitt „Anleitung: Veröffentlichen mit Google“.
`);
  process.exit(1);
}

console.log(`Firebase-Projekt: ${projectId}`);
