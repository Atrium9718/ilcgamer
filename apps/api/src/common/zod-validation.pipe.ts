import { Injectable, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

/** Valida cuerpo/parámetros con los esquemas de @ilc/contracts; un ZodError se convierte en VALIDATION_FAILED. */
@Injectable()
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    return this.schema.parse(value);
  }
}
