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
    JwtModule,
  ],
})
export class AuthModule {}
