import { Module } from '@nestjs/common';
import { AuthDirectoryRepository } from '@/domain/auth/application/repositories/auth-directory-repository';
import { JwtModule } from '@nestjs/jwt';
import { AuthSessionManager } from '@/domain/auth/application/repositories/auth-session-manager';
import { DatabaseModule } from '@/infra/database/database.module';
import { EnvModule } from '@/infra/env/env.module';
import { ApiAuthService } from './api-auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { PublicAuthRateLimitGuard } from './public-auth-rate-limit.guard';
import { RolesGuard } from './roles.guard';
import { LocalPasswordIdentityService } from './local-password-identity.service';
import { LocalAuthActionTokensService } from './local-auth-action-tokens.service';
import { LocalAdminInvitationsService } from './local-admin-invitations.service';
import { LocalPasswordResetService } from './local-password-reset.service';
import {
  PasswordResetMailSender,
  ResendPasswordResetMailSender,
} from './local-password-reset-mail-sender';
import {
  LocalInvitationMailSender,
  ResendInvitationMailSender,
} from './local-invitation-mail-sender';
import { SupabaseAuthService } from './supabase-auth.service';
import { TrustedOriginGuard } from './trusted-origin.guard';
import { TeacherAttendanceScopeGuard } from './teacher-attendance-scope.guard';

@Module({
  imports: [DatabaseModule, EnvModule, JwtModule.register({})],
  providers: [
    ApiAuthService,
    {
      provide: AuthSessionManager,
      useExisting: ApiAuthService,
    },
    {
      provide: AuthDirectoryRepository,
      useExisting: SupabaseAuthService,
    },
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
    TeacherAttendanceScopeGuard,
    PublicAuthRateLimitGuard,
    TrustedOriginGuard,
    SupabaseAuthService,
    LocalPasswordIdentityService,
    LocalAuthActionTokensService,
    LocalAdminInvitationsService,
    LocalPasswordResetService,
    {
      provide: PasswordResetMailSender,
      useClass: ResendPasswordResetMailSender,
    },
    {
      provide: LocalInvitationMailSender,
      useClass: ResendInvitationMailSender,
    },
  ],
  exports: [
    AuthSessionManager,
    AuthDirectoryRepository,
    ApiAuthService,
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
    TeacherAttendanceScopeGuard,
    PublicAuthRateLimitGuard,
    TrustedOriginGuard,
    SupabaseAuthService,
    LocalPasswordIdentityService,
    LocalAuthActionTokensService,
    LocalAdminInvitationsService,
    LocalPasswordResetService,
    JwtModule,
  ],
})
export class AuthModule {}
