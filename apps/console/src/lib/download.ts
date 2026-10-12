import type { DownloadedFile } from './api.ts';

/** Entrega un archivo descargado de la API al navegador sin guardarlo en ningún otro lado. */
export function saveFile({ fileName, blob }: DownloadedFile): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
