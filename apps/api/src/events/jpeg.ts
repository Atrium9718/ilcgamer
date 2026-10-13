/**
 * Limpieza de fotos de concursos. Solo se aceptan JPEG (el cliente convierte con un canvas) y el servidor vuelve a escribir el
 * archivo sin los segmentos de metadatos (EXIF con ubicación y cámara, XMP, comentarios…): nunca se publica lo que la persona
 * no vio. No decodifica píxeles: recorre los segmentos del formato y copia los de imagen tal cual.
 */
export interface CleanJpeg {
  data: Buffer;
  width: number;
  height: number;
}

const MIN_SIDE = 200;
const MAX_SIDE = 6000;
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

export function sanitizeJpeg(input: Buffer): CleanJpeg | null {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) return null;
  const parts: Buffer[] = [Buffer.from([0xff, 0xd8])];
  let width = 0;
  let height = 0;
  let pos = 2;
  while (pos < input.length) {
    if (input[pos] !== 0xff) return null;
    while (input[pos] === 0xff) pos++; // relleno
    const marker = input[pos++];
    if (marker === undefined) return null;
    if (marker === 0xd9) return null; // EOI antes de los datos de imagen
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(Buffer.from([0xff, marker]));
      continue;
    }
    if (pos + 2 > input.length) return null;
    const length = input.readUInt16BE(pos);
    if (length < 2 || pos + length > input.length) return null;
    const segment = input.subarray(pos - 2, pos + length);
    if (SOF.has(marker)) {
      if (length < 8) return null;
      height = input.readUInt16BE(pos + 3);
      width = input.readUInt16BE(pos + 5);
    }
    const isApp = marker >= 0xe0 && marker <= 0xef;
    const isComment = marker === 0xfe;
    // Se conserva JFIF (APP0); se descartan EXIF/XMP/ICC/comentarios y cualquier otro APPn.
    if ((isApp && marker !== 0xe0) || isComment) {
      pos += length;
      continue;
    }
    parts.push(segment);
    pos += length;
    if (marker === 0xda) {
      // Inicio del escaneo: lo que sigue son datos comprimidos hasta el final; se copian completos.
      parts.push(input.subarray(pos));
      break;
    }
  }
  if (!width || !height || width < MIN_SIDE || height < MIN_SIDE || width > MAX_SIDE || height > MAX_SIDE) return null;
  const data = Buffer.concat(parts);
  if (data[data.length - 2] !== 0xff || data[data.length - 1] !== 0xd9) return null;
  return { data, width, height };
}
