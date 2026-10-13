import { timingSafeEqual } from 'node:crypto';

const BUCKETS = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];

interface Series {
  count: number;
  sum: number;
  buckets: number[];
}

/**
 * Métricas en formato Prometheus (Guía Técnica §11: observabilidad). Se etiqueta por la ruta con plantilla
 * (`/rewards/:id/claim`), nunca por la URL real, así no pasan tokens, PIN ni identificadores a las métricas.
 */
export class Metrics {
  private readonly requests = new Map<string, number>();
  private readonly durations = new Map<string, Series>();
  private readonly startedAt = Date.now();

  record(method: string, route: string, status: number, seconds: number): void {
    const rk = `${method}\u0000${route}\u0000${status}`;
    this.requests.set(rk, (this.requests.get(rk) ?? 0) + 1);
    const dk = `${method}\u0000${route}`;
    const s = this.durations.get(dk) ?? { count: 0, sum: 0, buckets: BUCKETS.map(() => 0) };
    s.count += 1;
    s.sum += seconds;
    BUCKETS.forEach((b, i) => {
      if (seconds <= b) s.buckets[i] = (s.buckets[i] ?? 0) + 1;
    });
    this.durations.set(dk, s);
  }

  /** Texto de exposición; `gauges` son valores medidos al momento de la consulta (salud, incidentes abiertos…). */
  render(gauges: Record<string, number>): string {
    const lines: string[] = [];
    lines.push('# HELP ilc_http_requests_total Solicitudes HTTP por método, ruta y estado.', '# TYPE ilc_http_requests_total counter');
    for (const [k, v] of this.requests) {
      const [m, r, s] = k.split('\u0000') as [string, string, string];
      lines.push(`ilc_http_requests_total{method="${m}",route="${r}",status="${s}"} ${v}`);
    }
    lines.push('# HELP ilc_http_request_duration_seconds Duración de solicitudes HTTP.', '# TYPE ilc_http_request_duration_seconds histogram');
    for (const [k, s] of this.durations) {
      const [m, r] = k.split('\u0000') as [string, string];
      BUCKETS.forEach((b, i) => {
        lines.push(`ilc_http_request_duration_seconds_bucket{method="${m}",route="${r}",le="${b}"} ${s.buckets[i]}`);
      });
      lines.push(`ilc_http_request_duration_seconds_bucket{method="${m}",route="${r}",le="+Inf"} ${s.count}`);
      lines.push(`ilc_http_request_duration_seconds_sum{method="${m}",route="${r}"} ${s.sum.toFixed(6)}`);
      lines.push(`ilc_http_request_duration_seconds_count{method="${m}",route="${r}"} ${s.count}`);
    }
    const mem = process.memoryUsage();
    const all: Record<string, number> = {
      ilc_process_uptime_seconds: Math.round((Date.now() - this.startedAt) / 1000),
      ilc_process_resident_memory_bytes: mem.rss,
      ilc_process_heap_used_bytes: mem.heapUsed,
      ...gauges,
    };
    for (const [name, value] of Object.entries(all)) lines.push(`# TYPE ${name} gauge`, `${name} ${value}`);
    return `${lines.join('\n')}\n`;
  }
}

/** Compara en tiempo constante el Bearer recibido con el token configurado. */
export function bearerMatches(header: string | undefined, token: string): boolean {
  const given = Buffer.from((header ?? '').replace(/^Bearer\s+/i, ''));
  const wanted = Buffer.from(token);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}
