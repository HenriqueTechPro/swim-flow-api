import { Body, Controller, Header, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LocalAuthActionTokensService } from '@/infra/auth/local-auth-action-tokens.service';
import { LocalPasswordResetService } from '@/infra/auth/local-password-reset.service';
import { LocalPasswordResetOriginGuard } from '@/infra/auth/local-password-reset-origin.guard';
import { LocalPasswordResetRolloutGuard } from '@/infra/auth/local-password-reset-rollout.guard';
import { PublicAuthRateLimitGuard } from '@/infra/auth/public-auth-rate-limit.guard';
import {
  confirmLocalPasswordResetSchema,
  requestLocalPasswordResetSchema,
  type ConfirmLocalPasswordResetDto,
  type RequestLocalPasswordResetDto,
} from '@/shared/contracts/local-password-reset';
import { ZodValidationPipe } from '../pipes/zod-validation-pipe';

@ApiTags('auth')
@Controller('/api/auth/local-password-reset')
export class LocalPasswordResetController {
  constructor(
    private readonly resets: LocalPasswordResetService,
    private readonly actions: LocalAuthActionTokensService,
  ) {}

  @Post('request')
  @Header('Cache-Control', 'no-store')
  @UseGuards(
    LocalPasswordResetRolloutGuard,
    LocalPasswordResetOriginGuard,
    PublicAuthRateLimitGuard,
  )
  async requestLocalPasswordReset(
    @Body(new ZodValidationPipe(requestLocalPasswordResetSchema))
    body: RequestLocalPasswordResetDto,
  ) {
    await this.resets.request(body.email);
    return { data: { success: true } };
  }

  @Post('confirm')
  @Header('Cache-Control', 'no-store')
  @UseGuards(
    LocalPasswordResetRolloutGuard,
    LocalPasswordResetOriginGuard,
    PublicAuthRateLimitGuard,
  )
  async confirmLocalPasswordReset(
    @Body(new ZodValidationPipe(confirmLocalPasswordResetSchema))
    body: ConfirmLocalPasswordResetDto,
  ) {
    await this.actions.redeemWithPassword(
      body.token,
      'PASSWORD_RESET',
      body.password,
    );
    // Password reset revokes existing sessions; it never creates a new one.
    return { data: { success: true } };
  }
}
