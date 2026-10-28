import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { Readable } from 'node:stream';
import type { Response } from 'express';
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
import { PrivateImageAccessService } from '../services/private-image-access.service';

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

const activatePrivateImageSchema = z
  .object({ expectedMediaId: z.string().uuid().nullable() })
  .strict();

type ActivatePrivateImageBody = z.infer<typeof activatePrivateImageSchema>;
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
    private readonly privateImageAccess: PrivateImageAccessService,
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

  /**
   * Activate only a VERIFIED private Blob candidate that belongs to the
   * actor's currently authorized resource. expectedMediaId is mandatory:
   * null means first photo; a UUID performs an atomic replacement.
   */
  @Post('private-image/:uploadId/activate')
  @Permissions('uploads:write')
  async activatePrivateImage(
    @CurrentUser() user: AuthUser,
    @Param('uploadId', new ParseUUIDPipe()) uploadId: string,
    @Body(new ZodValidationPipe(activatePrivateImageSchema))
    body: ActivatePrivateImageBody,
  ) {
    return {
      data: await this.privateImageAccess.activate(
        user.id,
        uploadId,
        body.expectedMediaId,
      ),
    };
  }

  /**
   * No public URL or redirect is ever issued. Domain authorization checks
   * the CURRENT role, target existence and ACTIVE media binding before
   * retrieving bytes from private storage.
   */
  @Get('private-image/:uploadId')
  @Permissions('uploads:write')
  async readPrivateImage(
    @CurrentUser() user: AuthUser,
    @Param('uploadId', new ParseUUIDPipe()) uploadId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const image = await this.privateImageAccess.download(user.id, uploadId);
    for (const [name, value] of Object.entries(image.headers)) {
      response.setHeader(name, value);
    }
    return new StreamableFile(Readable.from(image.stream));
  }
}
