/**
 * Macht das ganze Fenster zur Ablagefläche für Dateien.
 * Während des Ziehens bekommt `highlight` die Klasse `drop`.
 */
export function setupDropZone(highlight: HTMLElement, onFile: (file: File) => void): void {
  let depth = 0;
  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

  window.addEventListener('dragenter', e => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth++;
    highlight.classList.add('drop');
  });
  window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (!depth) highlight.classList.remove('drop');
  });
  window.addEventListener('drop', e => {
    e.preventDefault();
    depth = 0;
    highlight.classList.remove('drop');
    const file = e.dataTransfer?.files?.[0];
    if (file) onFile(file);
  });
}
