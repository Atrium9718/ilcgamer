import type { ShareCardContent, ShareTemplate } from '@ilc/ui';

/**
 * Tarjeta social vertical 1080 × 1920 (Instrucciones §12; Guía Técnica §5.10). El contenido es solo un logro cultural:
 * sin nombre completo, teléfono, ubicación, cantidades ni mensajes de presión; compartir es siempre voluntario.
 */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;

const PALETTE: Record<ShareTemplate, { top: string; bottom: string; accent: string }> = {
  bosque: { top: '#1d3a30', bottom: '#0c1613', accent: '#d4b673' },
  roble: { top: '#4a2b14', bottom: '#14100c', accent: '#e0a36b' },
  montana: { top: '#1f3a4a', bottom: '#0c1316', accent: '#9fd0c0' },
};

/** Texto de la tarjeta a partir del logro más reciente. Nunca incluye cifras ni datos de la persona. */
export function buildCardContent(badge: { name: string; icon: string } | null, groupName?: string): ShareCardContent {
  if (!badge)
    return { badgeName: 'Explorador del origen', badgeIcon: 'explore', headline: 'Descubriendo el origen', message: 'Una ruta por la cultura de Caldas' };
  return {
    badgeName: badge.name,
    badgeIcon: badge.icon,
    headline: badge.name,
    message: groupName ? `El Parche '${groupName}' completó una ruta del origen` : 'Completé una ruta del origen de Caldas',
  };
}

/** Texto en varias líneas dentro de un ancho máximo. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Dibuja la tarjeta en un canvas y devuelve el PNG. Corre en el dispositivo: nada de esto sale del teléfono. */
export async function renderCard(content: ShareCardContent, template: ShareTemplate, legal: string): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Tu navegador no puede generar la imagen.');
  const p = PALETTE[template];
  const g = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT);
  g.addColorStop(0, p.top);
  g.addColorStop(1, p.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.textAlign = 'center';
  ctx.fillStyle = p.accent;
  ctx.font = '600 36px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('INDUSTRIA LICORERA DE CALDAS', CARD_WIDTH / 2, 190);

  ctx.beginPath();
  ctx.arc(CARD_WIDTH / 2, 760, 200, 0, Math.PI * 2);
  ctx.lineWidth = 8;
  ctx.strokeStyle = p.accent;
  ctx.stroke();
  ctx.font = '700 150px "EB Garamond", Georgia, serif';
  ctx.fillText(content.badgeName.slice(0, 1).toUpperCase(), CARD_WIDTH / 2, 810);

  ctx.fillStyle = '#f4efe3';
  ctx.font = '600 88px "EB Garamond", Georgia, serif';
  const title = wrap(ctx, content.headline, CARD_WIDTH - 200);
  title.forEach((l, i) => {
    ctx.fillText(l, CARD_WIDTH / 2, 1130 + i * 100);
  });
  ctx.font = '400 46px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillStyle = '#d8d2c4';
  wrap(ctx, content.message, CARD_WIDTH - 240).forEach((l, i) => {
    ctx.fillText(l, CARD_WIDTH / 2, 1130 + title.length * 100 + 40 + i * 64);
  });

  ctx.fillStyle = p.accent;
  ctx.font = '600 40px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('ilc.app', CARD_WIDTH / 2, 1700);
  ctx.fillStyle = '#b9b3a6';
  ctx.font = '500 26px "Plus Jakarta Sans", system-ui, sans-serif';
  wrap(ctx, legal.toUpperCase(), CARD_WIDTH - 160).forEach((l, i) => {
    ctx.fillText(l, CARD_WIDTH / 2, 1790 + i * 36);
  });

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No pudimos generar la imagen.'))), 'image/png'));
}
