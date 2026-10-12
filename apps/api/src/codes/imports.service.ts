import { createHash } from 'node:crypto';
import {
  BatchLabelSchema,
  IMPORT_COLUMNS,
  type ImportPreview,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  MIN_RECOMMENDED_TOKEN_LENGTH,
  SmartTagTokenSchema,
} from '@ilc/contracts';
import { Injectable } from '@nestjs/common';
import { parse as parseCsv } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { AuditService } from '../audit/audit.service.ts';
import type { Actor } from '../campaigns/campaigns.service.ts';
import { DomainError } from '../common/domain-error.ts';
import type { CodeImport } from '../generated/prisma/client.ts';
import { Prisma } from '../generated/prisma/client.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { csvLine } from './csv.ts';
import { maskedHint, productTokenHash, tokenHint } from './tokens.ts';

/** Un XLSX es un ZIP: se rechaza si su contenido descomprimido supera este tamaño (bomba de descompresión). */
const MAX_XLSX_UNCOMPRESSED = 200 * 1024 * 1024;
const PREVIEW_ISSUES = 20;
const CHUNK = 5000;

interface Summary {
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  errorRows: number;
  warnings: string[];
  issues: Array<{ line: number; tokenHint: string; message: string }>;
  groups: Array<{ sku: string; batch: string; rows: number }>;
}

type RawRow = { line: number; token: string; sku: string; batch: string; supplier: string };

/**
 * Importación de Smart Tags de imprenta (Instrucciones §10; Guía Técnica §5.6): vista previa, validación fila
 * por fila y resultado descargable. El archivo no se conserva y el token en claro no se guarda: solo su hash.
 * Nada entra al inventario hasta confirmar, y un mismo archivo no se puede confirmar dos veces (§9.2).
 */
@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async preview(actor: Actor, fileName: string, file: Buffer): Promise<ImportPreview> {
    if (!Buffer.isBuffer(file) || file.length === 0) throw new DomainError('VALIDATION_FAILED', 'El archivo está vacío.');
    if (file.length > MAX_IMPORT_BYTES) throw new DomainError('VALIDATION_FAILED', 'El archivo supera 10 MB. Divídelo en varias importaciones.');
    const fileSha256 = createHash('sha256').update(file).digest('hex');
    const already = await this.prisma.codeImport.findFirst({ where: { fileSha256, status: 'CONFIRMADA' } });
    if (already) throw new DomainError('CONFLICT', `Este archivo ya se importó el ${already.confirmedAt?.toISOString().slice(0, 10)}.`);

    const raw = await this.readRows(fileName, file);
    if (raw.length > MAX_IMPORT_ROWS) throw new DomainError('VALIDATION_FAILED', `Máximo ${MAX_IMPORT_ROWS.toLocaleString('es-CO')} filas por importación.`);

    const products = new Map((await this.prisma.product.findMany({ select: { id: true, sku: true } })).map((p) => [p.sku, p.id]));
    const revoked = await this.prisma.batch.findMany({ where: { revokedAt: { not: null } }, select: { label: true, product: { select: { sku: true } } } });
    const revokedKey = new Set(revoked.map((b) => `${b.product.sku}|${b.label}`));

    const seen = new Set<string>();
    const rows = raw.map((r) => {
      const hint = tokenHint(r.token);
      const base = {
        line: r.line,
        tokenHint: hint,
        sku: r.sku || null,
        batchLabel: r.batch || null,
        supplier: r.supplier || null,
        tokenHash: null as string | null,
      };
      const error = !r.token
        ? 'Falta el token'
        : !SmartTagTokenSchema.safeParse(r.token).success
          ? 'Token con formato no válido (8 a 64 letras, números, - o _)'
          : !r.sku
            ? 'Falta el SKU'
            : !products.has(r.sku)
              ? `SKU ${r.sku} no existe en el catálogo`
              : !r.batch || !BatchLabelSchema.safeParse(r.batch).success
                ? 'Lote vacío o con caracteres no permitidos'
                : r.supplier.length > 60
                  ? 'Proveedor de más de 60 caracteres'
                  : revokedKey.has(`${r.sku}|${r.batch}`)
                    ? 'El lote está revocado'
                    : null;
      if (error) return { ...base, error, duplicate: false };
      const tokenHash = productTokenHash(r.token);
      const duplicate = seen.has(tokenHash);
      seen.add(tokenHash);
      return { ...base, tokenHash, error: duplicate ? 'Token repetido dentro del archivo' : null, duplicate };
    });

    // Duplicados contra el inventario existente, por bloques.
    const hashes = rows.filter((r) => r.tokenHash && !r.error).map((r) => r.tokenHash as string);
    const existing = new Set<string>();
    for (let i = 0; i < hashes.length; i += CHUNK) {
      const found = await this.prisma.productCode.findMany({ where: { tokenHash: { in: hashes.slice(i, i + CHUNK) } }, select: { tokenHash: true } });
      for (const f of found) existing.add(f.tokenHash);
    }
    for (const r of rows) {
      if (r.tokenHash && !r.error && existing.has(r.tokenHash)) Object.assign(r, { error: 'El token ya existe en el inventario', duplicate: true });
    }

    const valid = rows.filter((r) => !r.error);
    const groups = new Map<string, { sku: string; batch: string; rows: number }>();
    for (const r of valid) {
      const k = `${r.sku}|${r.batchLabel}`;
      const g = groups.get(k) ?? { sku: r.sku as string, batch: r.batchLabel as string, rows: 0 };
      g.rows++;
      groups.set(k, g);
    }
    const shortTokens = rows.filter((r, i) => !r.error && (raw[i]?.token.length ?? 0) < MIN_RECOMMENDED_TOKEN_LENGTH).length;
    const warnings = [
      ...(shortTokens
        ? [
            `${shortTokens} tokens tienen menos de ${MIN_RECOMMENDED_TOKEN_LENGTH} caracteres: son más fáciles de adivinar. Pide a la imprenta tokens más largos.`,
          ]
        : []),
    ];
    const summary: Summary = {
      totalRows: rows.length,
      validRows: valid.length,
      duplicateRows: rows.filter((r) => r.duplicate).length,
      errorRows: rows.filter((r) => r.error && !r.duplicate).length,
      warnings,
      issues: rows
        .filter((r) => r.error)
        .slice(0, PREVIEW_ISSUES)
        .map((r) => ({ line: r.line, tokenHint: maskedHint(r.tokenHint), message: r.error as string })),
      groups: [...groups.values()],
    };

    const created = await this.prisma.$transaction(
      async (tx) => {
        const imp = await tx.codeImport.create({
          data: { fileName: fileName.slice(0, 200), fileSha256, createdById: actor.userId, summary: summary as unknown as Prisma.InputJsonValue },
        });
        for (let i = 0; i < rows.length; i += CHUNK) {
          await tx.codeImportRow.createMany({ data: rows.slice(i, i + CHUNK).map((r) => ({ ...r, importId: imp.id })) });
        }
        return imp;
      },
      { timeout: 60_000 },
    );
    await this.audit.record({
      actorId: actor.userId,
      action: 'smarttags.import_previewed',
      resource: 'code_import',
      resourceId: created.id,
      requestId: actor.requestId,
      metadata: { fileSha256, totalRows: summary.totalRows, validRows: summary.validRows },
    });
    return this.view(created);
  }

  async get(id: string): Promise<ImportPreview> {
    return this.view(await this.find(id));
  }

  /** Confirma todo o nada: si el inventario cambió desde la vista previa, no se importa nada. */
  async confirm(actor: Actor, id: string): Promise<ImportPreview> {
    const imp = await this.find(id);
    if (imp.status !== 'PREVISTA') throw new DomainError('CONFLICT', 'Esta importación ya fue confirmada o descartada.');
    const summary = imp.summary as unknown as Summary;
    if (summary.validRows === 0) throw new DomainError('CONFLICT', 'No hay filas válidas para importar.');
    try {
      const updated = await this.prisma.$transaction(
        async (tx) => {
          for (const g of summary.groups) {
            const product = await tx.product.findUniqueOrThrow({ where: { sku: g.sku } });
            const batch = await tx.batch.upsert({
              where: { productId_label: { productId: product.id, label: g.batch } },
              update: {},
              create: { productId: product.id, label: g.batch },
            });
            if (batch.revokedAt) throw new DomainError('CONFLICT', `El lote ${g.batch} fue revocado después de la vista previa. Vuelve a cargar el archivo.`);
          }
          const inserted = await tx.$executeRaw`
            INSERT INTO product_codes (id, "tokenHash", "tokenHint", "productId", "batchId", supplier, status, "importId", "createdAt")
            SELECT gen_random_uuid(), r."tokenHash", r."tokenHint", p.id, b.id, r.supplier, 'ASIGNADO_A_LOTE', ${imp.id}::uuid, now()
            FROM code_import_rows r
            JOIN products p ON p.sku = r.sku
            JOIN batches b ON b."productId" = p.id AND b.label = r."batchLabel"
            WHERE r."importId" = ${imp.id}::uuid AND r.error IS NULL
            ON CONFLICT ("tokenHash") DO NOTHING`;
          if (inserted !== summary.validRows) {
            throw new DomainError('CONFLICT', 'El inventario cambió desde la vista previa (algunos tokens ya existen). Vuelve a cargar el archivo.');
          }
          const done = await tx.codeImport.update({ where: { id: imp.id }, data: { status: 'CONFIRMADA', confirmedAt: new Date() } });
          await this.audit.record(
            {
              actorId: actor.userId,
              action: 'smarttags.imported',
              resource: 'code_import',
              resourceId: imp.id,
              requestId: actor.requestId,
              metadata: { inserted, fileSha256: imp.fileSha256 },
            },
            tx,
          );
          return done;
        },
        { timeout: 120_000 },
      );
      return this.view(updated);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new DomainError('CONFLICT', 'Este archivo ya se importó.');
      }
      throw err;
    }
  }

  async discard(actor: Actor, id: string): Promise<ImportPreview> {
    const imp = await this.find(id);
    if (imp.status !== 'PREVISTA') throw new DomainError('CONFLICT', 'Esta importación ya fue confirmada o descartada.');
    const updated = await this.prisma.codeImport.update({ where: { id }, data: { status: 'DESCARTADA' } });
    await this.audit.record({
      actorId: actor.userId,
      action: 'smarttags.import_discarded',
      resource: 'code_import',
      resourceId: id,
      requestId: actor.requestId,
    });
    return this.view(updated);
  }

  /** Resultado descargable: filas rechazadas con su motivo (sin tokens completos). */
  async issuesCsv(id: string): Promise<{ fileName: string; csv: string }> {
    const imp = await this.find(id);
    const rows = await this.prisma.codeImportRow.findMany({ where: { importId: id, error: { not: null } }, orderBy: { line: 'asc' } });
    const lines = [
      csvLine(['linea', 'codigo', 'sku', 'lote', 'motivo']),
      ...rows.map((r) => csvLine([String(r.line), maskedHint(r.tokenHint), r.sku ?? '', r.batchLabel ?? '', r.error ?? ''])),
    ];
    return { fileName: `errores-${imp.fileName.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_-]/g, '_')}.csv`, csv: `﻿${lines.join('\r\n')}\r\n` };
  }

  // ───────── Lectura de archivos ─────────

  private async readRows(fileName: string, file: Buffer): Promise<RawRow[]> {
    const isZip = file.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.xlsx') || isZip) {
      if (!isZip) throw new DomainError('VALIDATION_FAILED', 'El archivo .xlsx no es válido.');
      return this.readXlsx(file);
    }
    if (!lower.endsWith('.csv') && !lower.endsWith('.txt')) throw new DomainError('VALIDATION_FAILED', 'Formato no admitido: usa .csv o .xlsx.');
    return this.readCsv(file);
  }

  private readCsv(file: Buffer): RawRow[] {
    let records: string[][];
    try {
      records = parseCsv(file, { bom: true, delimiter: [',', ';', '\t'], relax_column_count: true, skip_empty_lines: true, trim: true }) as string[][];
    } catch {
      throw new DomainError('VALIDATION_FAILED', 'No pudimos leer el CSV. Revisa que use comas o punto y coma y comillas balanceadas.');
    }
    return this.mapRecords(records);
  }

  private async readXlsx(file: Buffer): Promise<RawRow[]> {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(file);
    } catch {
      throw new DomainError('VALIDATION_FAILED', 'El archivo .xlsx está dañado o cifrado.');
    }
    let uncompressed = 0;
    zip.forEach((_p, entry) => {
      uncompressed += (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    });
    if (uncompressed > MAX_XLSX_UNCOMPRESSED) throw new DomainError('VALIDATION_FAILED', 'El .xlsx es demasiado grande al descomprimirlo.');

    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(file as unknown as ArrayBuffer);
    } catch {
      throw new DomainError('VALIDATION_FAILED', 'No pudimos leer el .xlsx.');
    }
    const sheet = wb.worksheets[0];
    if (!sheet) throw new DomainError('VALIDATION_FAILED', 'El .xlsx no tiene hojas.');
    const records: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      for (let c = 1; c <= row.cellCount; c++) cells.push(row.getCell(c).text.trim());
      records.push(cells);
    });
    return this.mapRecords(records);
  }

  private mapRecords(records: string[][]): RawRow[] {
    const [header, ...data] = records;
    if (!header) throw new DomainError('VALIDATION_FAILED', 'El archivo no tiene filas.');
    const norm = header.map((h) => h.trim().toLowerCase());
    const col = (names: readonly string[]) => norm.findIndex((h) => names.includes(h));
    const idx = { token: col(IMPORT_COLUMNS.token), sku: col(IMPORT_COLUMNS.sku), batch: col(IMPORT_COLUMNS.batch), supplier: col(IMPORT_COLUMNS.supplier) };
    const missing = (['token', 'sku', 'batch'] as const).filter((k) => idx[k] < 0);
    if (missing.length) {
      throw new DomainError(
        'VALIDATION_FAILED',
        `Faltan columnas: ${missing.map((m) => IMPORT_COLUMNS[m][0]).join(', ')}. La primera fila debe tener los encabezados token, sku, lote y (opcional) proveedor.`,
      );
    }
    const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');
    return data.map((r, i) => ({
      line: i + 2,
      token: cell(r, idx.token),
      sku: cell(r, idx.sku).toUpperCase(),
      batch: cell(r, idx.batch),
      supplier: cell(r, idx.supplier),
    }));
  }

  private async find(id: string): Promise<CodeImport> {
    const imp = await this.prisma.codeImport.findUnique({ where: { id } });
    if (!imp) throw new DomainError('NOT_FOUND', 'No existe esa importación.');
    return imp;
  }

  private view(imp: CodeImport): ImportPreview {
    const s = imp.summary as unknown as Summary;
    return {
      id: imp.id,
      fileName: imp.fileName,
      status: imp.status,
      ...s,
      createdAt: imp.createdAt.toISOString(),
      confirmedAt: imp.confirmedAt?.toISOString() ?? null,
    };
  }
}
