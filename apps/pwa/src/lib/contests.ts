import type { ContestScreen, ContestView, PublicEvent, UpsertEntry } from '@ilc/contracts';
import { apiRequest } from './api.ts';

/** Cliente de eventos y concursos. Todo lo decide el servidor: fases, voto único, moderación y ganador. */
export const contestsApi = {
  events: () => apiRequest<PublicEvent[]>('/events'),
  contest: (id: string) => apiRequest<ContestView>(`/contests/${encodeURIComponent(id)}`),
  saveEntry: (id: string, body: UpsertEntry) => apiRequest<ContestView>(`/contests/${encodeURIComponent(id)}/entries`, { method: 'POST', body }),
  uploadPhoto: (id: string, photo: Blob) =>
    apiRequest<ContestView>(`/contests/${encodeURIComponent(id)}/entries/me/photo`, { method: 'PUT', rawBody: photo, timeoutMs: 60_000 }),
  withdraw: (id: string) => apiRequest<void>(`/contests/${encodeURIComponent(id)}/entries/me`, { method: 'DELETE' }),
  vote: (id: string, entryId: string) => apiRequest<ContestView>(`/contests/${encodeURIComponent(id)}/votes`, { method: 'POST', body: { entryId } }),
  /** Pantalla pública: sin sesión (el acceso es el enlace secreto). */
  screen: (token: string, signal?: AbortSignal) => apiRequest<ContestScreen>(`/screens/${encodeURIComponent(token)}`, { signal, timeoutMs: 8000 }),
};

const MAX_SIDE = 1280;

/**
 * Reduce la foto en el dispositivo y la convierte a JPEG: sube mucho menos y, al redibujarla en un canvas, desaparecen los
 * metadatos (ubicación, cámara). El servidor además los vuelve a quitar. Corrige la orientación con createImageBitmap.
 */
export async function preparePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas no disponible');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  if (!blob) throw new Error('no se pudo convertir la foto');
  return blob;
}
