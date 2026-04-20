import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  updateProfileSchema,
  type UpdateProfileDto,
} from '@/shared/contracts/management';
import { GetProfileUseCase } from '@/domain/auth/application/use-cases/get-profile';
import { UpdateProfileUseCase } from '@/domain/auth/application/use-cases/update-profile';
import { CurrentUser } from '@/infra/auth/current-user.decorator';
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard';
import type { AuthUser } from '@/infra/auth/auth.types';
import { ZodValidationPipe } from '../pipes/zod-validation-pipe';
import { ProfilePresenter } from '../presenters/profile.presenter';

@ApiTags('profile')
@ApiBearerAuth('api-bearer')
@Controller('/api/profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private readonly getProfile: GetProfileUseCase,
    private readonly updateProfile: UpdateProfileUseCase,
  ) {}

  @Get()
  async show(@CurrentUser() user: AuthUser) {
    const { profile } = await this.getProfile.execute(user.id);

    return {
      data: profile ? ProfilePresenter.toHTTP(profile) : null,
    };
  }

  @Put()
  async update(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileDto,
  ) {
    const { profile } = await this.updateProfile.execute(user.id, {
      fullName: body.fullName,
      avatarUrl: body.avatarUrl,
    });

    return {
      data: ProfilePresenter.toHTTP(profile),
    };
  }
}
