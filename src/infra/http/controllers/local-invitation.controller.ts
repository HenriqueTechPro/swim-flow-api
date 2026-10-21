import {
  Body,
  Controller,
  Header,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LocalAuthActionTokensService } from '@/infra/auth/local-auth-action-tokens.service';
import { PublicAuthRateLimitGuard } from '@/infra/auth/public-auth-rate-limit.guard';
import { TrustedOriginGuard } from '@/infra/auth/trusted-origin.guard';
import {
  acceptLocalInvitationSchema,
  type AcceptLocalInvitationDto,
} from '@/shared/contracts/local-invitation';
import { ZodValidationPipe } from '../pipes/zod-validation-pipe';

@ApiTags('auth')
@Controller('/api/auth/local-invitations')
export class LocalInvitationController {
  constructor(private readonly actions: LocalAuthActionTokensService) {}

  // Token proof is in the POST body, never in a path, query string, or cookie.
  // No JWT or Supabase dependency: this action is intentionally public.
  @Post('accept')
  @Header('Cache-Control', 'no-store')
  @UseGuards(PublicAuthRateLimitGuard, TrustedOriginGuard)
  async acceptLocalInvitation(
    @Body(new ZodValidationPipe(acceptLocalInvitationSchema))
    body: AcceptLocalInvitationDto,
  ) {
    await this.actions.redeemWithPassword(
      body.token,
      'INVITATION',
      body.password,
    );

    // Do not mint a session here. Local login is switched only after cutover.
    return { data: { success: true } };
  }
}
