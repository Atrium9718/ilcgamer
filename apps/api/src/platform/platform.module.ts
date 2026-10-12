import { Global, Module } from '@nestjs/common';
import { PlatformController } from './platform.controller.ts';
import { SettingsService } from './settings.service.ts';

@Global()
@Module({ controllers: [PlatformController], providers: [SettingsService], exports: [SettingsService] })
export class PlatformModule {}
