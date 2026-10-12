import type { PublicConfig } from '@ilc/contracts';
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service.ts';

@ApiTags('Plataforma')
@Controller('config')
export class PlatformController {
  constructor(private readonly settings: SettingsService) {}

  /** Configuración pública para la PWA: nombre de la moneda, versión del aviso legal, canales de acceso. */
  @Get()
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/PublicConfig' } })
  config(): Promise<PublicConfig> {
    return this.settings.publicConfig();
  }
}
