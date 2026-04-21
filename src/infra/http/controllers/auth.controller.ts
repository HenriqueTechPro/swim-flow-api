import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ConfirmPasswordResetUseCase } from '@/domain/auth/application/use-cases/confirm-password-reset';
import { DeleteAccessProfileUseCase } from '@/domain/auth/application/use-cases/delete-access-profile';
import { GetProfileUseCase } from '@/domain/auth/application/use-cases/get-profile';
import { InviteUserUseCase } from '@/domain/auth/application/use-cases/invite-user';
import { ListAccessProfilesUseCase } from '@/domain/auth/application/use-cases/list-access-profiles';
import { LoginWithGoogleUseCase } from '@/domain/auth/application/use-cases/login-with-google';
import { LoginUseCase } from '@/domain/auth/application/use-cases/login';
import { LogoutUseCase } from '@/domain/auth/application/use-cases/logout';
import { RefreshSessionUseCase } from '@/domain/auth/application/use-cases/refresh-session';
import { RequestPasswordResetUseCase } from '@/domain/auth/application/use-cases/request-password-reset';
import { UpdateAccessProfileRoleUseCase } from '@/domain/auth/application/use-cases/update-access-profile-role';
import {
  confirmPasswordResetSchema,
  inviteUserSchema,
  loginSchema,
  oauthLoginSchema,
  requestPasswordResetSchema,
  updateAccessProfileRoleSchema,
  type ConfirmPasswordResetDto,
  type InviteUserDto,
  type LoginDto,
  type OAuthLoginDto,
  type RequestPasswordResetDto,
  type UpdateAccessProfileRoleDto,
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
import { AccessProfilePresenter } from '../presenters/access-profile.presenter';
import { ZodValidationPipe } from '../pipes/zod-validation-pipe';
import { AuthenticatedUserPresenter } from '../presenters/authenticated-user.presenter';
import { ProfilePresenter } from '../presenters/profile.presenter';

function getRequestContext(request: Request) {
  return {
    userAgent: request.headers['user-agent'] ?? null,
    ipAddress: request.ip ?? request.socket.remoteAddress ?? null,
  };
}

const unauthorizedAppAccessMessage =
  'User is not authorized for this application';

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
    private readonly deleteAccessProfileUseCase: DeleteAccessProfileUseCase,
    private readonly inviteUserUseCase: InviteUserUseCase,
    private readonly listAccessProfilesUseCase: ListAccessProfilesUseCase,
    private readonly updateAccessProfileRoleUseCase: UpdateAccessProfileRoleUseCase,
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
    try {
      const result = await this.loginWithGoogleUseCase.execute({
        accessToken: body.accessToken,
        ...getRequestContext(request),
      });

      setRefreshTokenCookie(response, this.envService, result.refreshToken);

      return {
        data: {
          authorized: true,
          accessToken: result.accessToken,
          accessTokenExpiresAt: result.accessTokenExpiresAt,
          user: result.user,
        },
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedException &&
        error.message === unauthorizedAppAccessMessage
      ) {
        clearRefreshTokenCookie(response, this.envService);

        return {
          data: {
            authorized: false,
            reason: 'invitation_required',
          },
        };
      }

      throw error;
    }
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

  @Get('access-profiles')
  @ApiBearerAuth('api-bearer')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin')
  @Permissions('auth:manage-users')
  async listAccessProfiles() {
    const { profiles } = await this.listAccessProfilesUseCase.execute();

    return {
      data: {
        profiles: profiles.map((profile) => AccessProfilePresenter.toHTTP(profile)),
      },
    };
  }

  @Patch('access-profiles/:id/role')
  @ApiBearerAuth('api-bearer')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin')
  @Permissions('auth:manage-users')
  async updateAccessProfileRole(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAccessProfileRoleSchema))
    body: UpdateAccessProfileRoleDto,
  ) {
    const { profile } = await this.updateAccessProfileRoleUseCase.execute({
      actorUserId: user.id,
      targetUserId: id,
      role: body.role,
    });

    return {
      data: {
        profile: ProfilePresenter.toHTTP(profile),
      },
    };
  }

  @Delete('access-profiles/:id')
  @ApiBearerAuth('api-bearer')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin')
  @Permissions('auth:manage-users')
  async deleteAccessProfile(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    const result = await this.deleteAccessProfileUseCase.execute({
      actorUserId: user.id,
      targetUserId: id,
    });

    return {
      data: result,
    };
  }
}
