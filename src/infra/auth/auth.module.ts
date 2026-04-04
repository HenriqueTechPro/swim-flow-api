import { Module } from '@nestjs/common'
import { DatabaseModule } from '@/infra/database/database.module'
import { EnvModule } from '@/infra/env/env.module'
import { JwtAuthGuard } from './jwt-auth.guard'
import { RolesGuard } from './roles.guard'
import { SupabaseAuthService } from './supabase-auth.service'

@Module({
  imports: [DatabaseModule, EnvModule],
  providers: [JwtAuthGuard, RolesGuard, SupabaseAuthService],
  exports: [JwtAuthGuard, RolesGuard, SupabaseAuthService],
})
export class AuthModule {}
