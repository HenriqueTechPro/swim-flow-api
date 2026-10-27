import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { CreateManagedUploadUseCase } from '@/domain/uploads/application/use-cases/create-managed-upload';
import {
  createManagedUploadSchema,
  managedUploadTargetValues,
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
import { MAX_PRIVATE_IMAGE_BYTES } from '@/domain/uploads/application/services/private-media-upload-policy';
import { PrivateImageUploadService } from '../services/private-image-upload.service';

const privateImageUploadSchema = z
  .object({
    target: z.enum(managedUploadTargetValues),
    resourceId: z.string().uuid().optional(),
  })
  .superRefine((data, context) => {
    if (data.target !== 'profile-avatar' && !data.resourceId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['resourceId'],
        message: 'Resource UUID is required for this photo',
      });
    }
    if (data.target === 'profile-avatar' && data.resourceId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['resourceId'],
        message: 'Profile avatar cannot target another resource',
      });
    }
  });

type PrivateImageUploadBody = z.infer<typeof privateImageUploadSchema>;
type UploadedImage = { buffer: Buffer; mimetype: string; size: number };

@ApiTags('uploads')
@ApiBearerAuth('api-bearer')
@Controller('/api/uploads')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin', 'teacher', 'user')
export class UploadsController {
  constructor(
    private readonly createManagedUpload: CreateManagedUploadUseCase,
    private readonly privateImageUpload: PrivateImageUploadService,
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

  /**
   * Verifies and stores one normalized JPEG in PRIVATE Vercel Blob.
   * This endpoint creates a VERIFIED candidate; it does not activate a photo
   * or return a public/blob URL. A separate audited binding step is required.
   */
  @Post('private-image')
  @Permissions('uploads:write')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_PRIVATE_IMAGE_BYTES,
        files: 1,
        fields: 2,
        parts: 4,
      },
    }),
  )
  async uploadPrivateImage(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(privateImageUploadSchema))
    body: PrivateImageUploadBody,
    @UploadedFile() file?: UploadedImage,
  ) {
    if (
      !file ||
      !(file.buffer instanceof Buffer) ||
      file.size < 8 ||
      file.size > MAX_PRIVATE_IMAGE_BYTES ||
      ![
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/gif',
      ].includes(file.mimetype.toLowerCase())
    ) {
      throw new BadRequestException('Invalid image upload');
    }

    return {
      data: await this.privateImageUpload.execute(user.id, {
        target: body.target,
        resourceId: body.resourceId,
        contentType: file.mimetype,
        bytes: file.buffer,
      }),
    };
  }
}
