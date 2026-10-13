import type { ClientEvent } from '@ilc/contracts';
import { apiRequest } from './api.ts';
import { data } from './data.ts';

/**
 * Eventos de analítica que informa la PWA (lista blanca del servidor; no afectan ninguna economía). Es "dispara y olvida":
 * si falla, la experiencia no cambia. En modo demostración no se envía nada.
 */
export function track(event: ClientEvent): void {
  if (data.demo) return;
  void apiRequest<void>('/events', { method: 'POST', body: event, timeoutMs: 5000 }).catch(() => undefined);
}
