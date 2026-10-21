import { Body, Controller, Header, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/infra/auth/current-user.decorator';
import type { AuthUser } from '@/infra/auth/auth.types';
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard';
import { LocalAdminInvitationsService } from '@/infra/auth/local-admin-invitations.service';
import { LocalAdminInvitationRolloutGuard } from '@/infra/auth/local-admin-invitation-rollout.guard';
import { Permissions } from '@/infra/auth/permissions.decorator';
import { PermissionsGuard } from '@/infra/auth/permissions.guard';
import { Roles } from '@/infra/auth/roles.decorator';
import { RolesGuard } from '@/infra/auth/roles.guard';
import { TrustedOriginGuard } from '@/infra/auth/trusted-origin.guard';
import {
  localAdminInvitationSchema,
  type LocalAdminInvitationDto,
} from '@/shared/contracts/local-admin-invitation';
import { ZodValidationPipe } from '../pipes/zod-validation-pipe';

@ApiTags('auth')
@Controller('/api/auth/local-invitations')
export class LocalAdminInvitationController {
  constructor(private readonly invitations: LocalAdminInvitationsService) {}

  // Distinct from the existing Supabase /api/auth/invitations route.
  // Disabled until both independent rollout gates are explicitly enabled.
  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth('api-bearer')
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
    LocalAdminInvitationRolloutGuard,
    TrustedOriginGuard,
  )
  @Roles('admin')
  @Permissions('auth:invite')
  async invite(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(localAdminInvitationSchema))
    body: LocalAdminInvitationDto,
  ) {
    await this.invitations.invite({
      actorUserId: actor.id,
      email: body.email,
      fullName: body.fullName,
      role: body.role,
    });
    // Do not leak invitee IDs, token hashes, links or delivery provider data.
    return { data: { success: true } };
  }
}
