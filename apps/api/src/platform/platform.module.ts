import { Global, Module } from '@nestjs/common';
import { PlatformController } from './platform.controller.ts';
import { RetentionService } from './retention.service.ts';
import { SettingsService } from './settings.service.ts';

@Global()
@Module({ controllers: [PlatformController], providers: [SettingsService, RetentionService], exports: [SettingsService, RetentionService] })
export class PlatformModule {}
