/** Lectura y escritura inmutable por ruta («look.accent», «spinner.labelTop») sobre la configuración de un juego. */
export function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((cur, key) => (cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[key] : undefined), obj);
}

export function setPath<T>(obj: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split('.');
  const record = (obj ?? {}) as Record<string, unknown>;
  return { ...record, [head as string]: rest.length ? setPath(record[head as string], rest.join('.'), value) : value } as T;
}
