import { describe, expect, it } from 'vitest';
import { sanitizeJpeg } from '../src/events/jpeg.ts';

const seg = (marker: number, body: Buffer) =>
  Buffer.concat([Buffer.from([0xff, marker]), Buffer.from([(body.length + 2) >> 8, (body.length + 2) & 0xff]), body]);
const sof = (w: number, h: number) => seg(0xc0, Buffer.from([8, h >> 8, h & 0xff, w >> 8, w & 0xff, 1, 1, 0x11, 0]));
const jfif = seg(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'binary'));
const exif = seg(0xe1, Buffer.from('Exif\0\0GPS-LATITUDE-4.5N', 'binary'));
const comment = seg(0xfe, Buffer.from('secreto'));
const scan = Buffer.concat([seg(0xda, Buffer.from([1, 1, 0, 0, 63, 0])), Buffer.from([0x12, 0x34, 0x56]), Buffer.from([0xff, 0xd9])]);
const jpeg = (...parts: Buffer[]) => Buffer.concat([Buffer.from([0xff, 0xd8]), ...parts, scan]);

describe('limpieza de fotos JPEG', () => {
  it('quita EXIF/ubicación y comentarios, conserva la imagen y devuelve las dimensiones', () => {
    const out = sanitizeJpeg(jpeg(jfif, exif, comment, sof(800, 600)));
    expect(out?.width).toBe(800);
    expect(out?.height).toBe(600);
    const text = out?.data.toString('binary') ?? '';
    expect(text).not.toContain('GPS-LATITUDE');
    expect(text).not.toContain('Exif');
    expect(text).not.toContain('secreto');
    expect(text).toContain('JFIF');
    expect(out?.data.subarray(-5).toString('hex')).toBe('123456ffd9');
  });

  it('rechaza lo que no es JPEG, está truncado, es demasiado pequeño o enorme', () => {
    expect(sanitizeJpeg(Buffer.from('GIF89a....'))).toBeNull();
    expect(sanitizeJpeg(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(sanitizeJpeg(jpeg(jfif, sof(100, 100)))).toBeNull();
    expect(sanitizeJpeg(jpeg(jfif, sof(8000, 8000)))).toBeNull();
    expect(sanitizeJpeg(jpeg(jfif, sof(800, 600)).subarray(0, 40))).toBeNull();
    expect(sanitizeJpeg(Buffer.from([0xff, 0xd8, 0xff, 0xd9]))).toBeNull();
  });
});
