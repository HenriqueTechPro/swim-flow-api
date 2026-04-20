import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateManagedUploadUseCase } from '@/domain/uploads/application/use-cases/create-managed-upload';
import {
  createManagedUploadSchema,
  type CreateManagedUploadDto,
} from '@/shared/contracts/uploads';
import { CurrentUser } from '@/infra/auth/current-user.decorator';
import type { AuthUser } from '@/infra/auth/auth.types';
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard';
import { Permissions } from '@/infra/auth/permissions.decorator';
import { PermissionsGuard } from '@/infra/auth/permissions.guard';
import { Roles } from '@/infra/auth/roles.decorator';
import { RolesGuard } from '@/infra/auth/roles.guard';
import { ZodValidationPipe } from '../pipes/zod-validation-pipe';

@ApiTags('uploads')
@ApiBearerAuth('api-bearer')
@Controller('/api/uploads')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin', 'teacher', 'user')
export class UploadsController {
  constructor(
    private readonly createManagedUpload: CreateManagedUploadUseCase,
  ) {}

  @Post('signed-url')
  @Permissions('uploads:write')
  async createSignedUrl(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createManagedUploadSchema))
    body: CreateManagedUploadDto,
  ) {
    return {
      data: await this.createManagedUpload.execute(
        {
          id: user.id,
          role: user.role,
        },
        body,
      ),
    };
  }
}
