import { Module } from '@nestjs/common';
import { AuthGuard, OptionalAuthGuard } from './auth.guard.ts';
import { AuthSessionService } from './auth-session.service.ts';
import { IdentityController } from './identity.controller.ts';
import { IdentityService } from './identity.service.ts';
import { OtpService } from './otp.service.ts';
import { otpSenderProvider } from './otp-sender.ts';

@Module({
  controllers: [IdentityController],
  providers: [IdentityService, AuthSessionService, OtpService, otpSenderProvider, AuthGuard, OptionalAuthGuard],
  exports: [AuthSessionService, AuthGuard, OptionalAuthGuard],
})
export class IdentityModule {}
