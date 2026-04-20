import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ConfirmPasswordResetUseCase } from '@/domain/auth/application/use-cases/confirm-password-reset';
import { GetProfileUseCase } from '@/domain/auth/application/use-cases/get-profile';
import { InviteUserUseCase } from '@/domain/auth/application/use-cases/invite-user';
import { LoginWithGoogleUseCase } from '@/domain/auth/application/use-cases/login-with-google';
import { LoginUseCase } from '@/domain/auth/application/use-cases/login';
import { LogoutUseCase } from '@/domain/auth/application/use-cases/logout';
import { RefreshSessionUseCase } from '@/domain/auth/application/use-cases/refresh-session';
import { RequestPasswordResetUseCase } from '@/domain/auth/application/use-cases/request-password-reset';
import {
  confirmPasswordResetSchema,
  inviteUserSchema,
  loginSchema,
  oauthLoginSchema,
  requestPasswordResetSchema,
  type ConfirmPasswordResetDto,
  type InviteUserDto,
  type LoginDto,
  type OAuthLoginDto,
  type RequestPasswordResetDto,
} from '@/shared/contracts/auth';
import { CurrentUser } from '@/infra/auth/current-user.decorator';
import type { AuthUser } from '@/infra/auth/auth.types';
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard';
import { Permissions } from '@/infra/auth/permissions.decorator';
import { PermissionsGuard } from '@/infra/auth/permissions.guard';
import { PublicAuthRateLimitGuard } from '@/infra/auth/public-auth-rate-limit.guard';
import {
  clearRefreshTokenCookie,
  getRefreshTokenFromRequest,
  setRefreshTokenCookie,
} from '@/infra/auth/refresh-token-cookie';
import { Roles } from '@/infra/auth/roles.decorator';
import { RolesGuard } from '@/infra/auth/roles.guard';
import { TrustedOriginGuard } from '@/infra/auth/trusted-origin.guard';
import { EnvService } from '@/infra/env/env.service';
import { ZodValidationPipe } from '../pipes/zod-validation-pipe';
import { AuthenticatedUserPresenter } from '../presenters/authenticated-user.presenter';

function getRequestContext(request: Request) {
  return {
    userAgent: request.headers['user-agent'] ?? null,
    ipAddress: request.ip ?? request.socket.remoteAddress ?? null,
  };
}

@ApiTags('auth')
@Controller('/api/auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly loginWithGoogleUseCase: LoginWithGoogleUseCase,
    private readonly refreshSessionUseCase: RefreshSessionUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
    private readonly confirmPasswordResetUseCase: ConfirmPasswordResetUseCase,
    private readonly inviteUserUseCase: InviteUserUseCase,
    private readonly getProfile: GetProfileUseCase,
    private readonly envService: EnvService,
  ) {}

  @Post('login')
  @UseGuards(PublicAuthRateLimitGuard)
  async login(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body(new ZodValidationPipe(loginSchema)) body: LoginDto,
  ) {
    const result = await this.loginUseCase.execute({
      email: body.email,
      password: body.password,
      ...getRequestContext(request),
    });

    setRefreshTokenCookie(response, this.envService, result.refreshToken);

    return {
      data: {
        accessToken: result.accessToken,
        accessTokenExpiresAt: result.accessTokenExpiresAt,
        user: result.user,
      },
    };
  }

  @Post('oauth/google')
  @UseGuards(PublicAuthRateLimitGuard)
  async loginWithGoogle(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body(new ZodValidationPipe(oauthLoginSchema)) body: OAuthLoginDto,
  ) {
    const result = await this.loginWithGoogleUseCase.execute({
      accessToken: body.accessToken,
      ...getRequestContext(request),
    });

    setRefreshTokenCookie(response, this.envService, result.refreshToken);

    return {
      data: {
        accessToken: result.accessToken,
        accessTokenExpiresAt: result.accessTokenExpiresAt,
        user: result.user,
      },
    };
  }

  @Post('refresh')
  @UseGuards(TrustedOriginGuard, PublicAuthRateLimitGuard)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = getRefreshTokenFromRequest(request, this.envService);
    if (!refreshToken) {
      clearRefreshTokenCookie(response, this.envService);
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const result = await this.refreshSessionUseCase.execute(refreshToken, {
      ...getRequestContext(request),
    });

    setRefreshTokenCookie(response, this.envService, result.refreshToken);

    return {
      data: {
        accessToken: result.accessToken,
        accessTokenExpiresAt: result.accessTokenExpiresAt,
        user: result.user,
      },
    };
  }

  @Post('logout')
  @UseGuards(TrustedOriginGuard)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = getRefreshTokenFromRequest(request, this.envService);
    const result = await this.logoutUseCase.execute(refreshToken);
    clearRefreshTokenCookie(response, this.envService);

    return {
      data: result,
    };
  }

  @Post('password-reset/request')
  @UseGuards(PublicAuthRateLimitGuard)
  async requestPasswordReset(
    @Body(new ZodValidationPipe(requestPasswordResetSchema))
    body: RequestPasswordResetDto,
  ) {
    const result = await this.requestPasswordResetUseCase.execute(body);

    return {
      data: result,
    };
  }

  @Post('password-reset/confirm')
  @UseGuards(PublicAuthRateLimitGuard)
  async confirmPasswordReset(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body(new ZodValidationPipe(confirmPasswordResetSchema))
    body: ConfirmPasswordResetDto,
  ) {
    const result = await this.confirmPasswordResetUseCase.execute({
      ...body,
      ...getRequestContext(request),
    });

    setRefreshTokenCookie(response, this.envService, result.refreshToken);

    return {
      data: {
        accessToken: result.accessToken,
        accessTokenExpiresAt: result.accessTokenExpiresAt,
        user: result.user,
      },
    };
  }

  @Get('me')
  @ApiBearerAuth('api-bearer')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthUser) {
    if (!user.email) {
      throw new UnauthorizedException('Authenticated user is missing email');
    }

    const { profile } = await this.getProfile.execute(user.id);

    if (!profile) {
      throw new UnauthorizedException('Profile not found for authenticated user');
    }

    return {
      data: {
        user: AuthenticatedUserPresenter.toHTTP(profile, user.email),
      },
    };
  }

  @Post('invitations')
  @ApiBearerAuth('api-bearer')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin')
  @Permissions('auth:invite')
  async inviteUser(
    @Body(new ZodValidationPipe(inviteUserSchema))
    body: InviteUserDto,
  ) {
    const result = await this.inviteUserUseCase.execute(body);

    return {
      data: result,
    };
  }
}
