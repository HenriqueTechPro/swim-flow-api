import { randomUUID } from 'node:crypto';
import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import type {
  CreateManagedUploadRequest,
  ManagedUploadTarget,
  ManagedUploadResult,
} from '@/domain/uploads/application/dtos/managed-upload';
import { ManagedUploadsRepository } from '@/domain/uploads/application/repositories/managed-uploads-repository';
import { EnvService } from '@/infra/env/env.service';

const contentTypeExtensionMap: Record<string, string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class SupabaseManagedUploadsRepository
  implements ManagedUploadsRepository
{
  constructor(private readonly envService: EnvService) {}

  async createSignedUpload(
    userId: string,
    input: CreateManagedUploadRequest,
  ): Promise<ManagedUploadResult> {
    const supabaseServiceRoleKey = this.envService.supabaseServiceRoleKey;
    if (!supabaseServiceRoleKey) {
      throw new ServiceUnavailableException(
        'Managed uploads are not configured',
      );
    }

    const supabase = createClient(
      this.envService.supabaseUrl,
      supabaseServiceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const path = this.buildPath(userId, input);
    const { data, error } = await supabase.storage
      .from('avatars')
      .createSignedUploadUrl(path, {
        upsert: input.target === 'profile-avatar',
      });

    if (error || !data) {
      throw new InternalServerErrorException(
        'Failed to create signed upload URL',
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('avatars').getPublicUrl(path);

    return {
      bucket: 'avatars',
      path,
      token: data.token,
      publicUrl,
    };
  }

  private buildPath(userId: string, input: CreateManagedUploadRequest) {
    const extension = this.resolveExtension(input.fileName, input.contentType);

    if (input.target === 'profile-avatar') {
      return `${userId}/avatar.${extension}`;
    }

    return `${this.resolveFolder(input.target)}/${input.resourceId}/${randomUUID()}.${extension}`;
  }

  private resolveFolder(
    target: Exclude<ManagedUploadTarget, 'profile-avatar'>,
  ) {
    switch (target) {
      case 'student-photo':
        return 'students';
      case 'teacher-photo':
        return 'teachers';
      case 'parent-photo':
        return 'parents';
    }
  }

  private resolveExtension(fileName: string, contentType: string) {
    const fromContentType = contentTypeExtensionMap[contentType.toLowerCase()];
    if (fromContentType) {
      return fromContentType;
    }

    const rawExtension = fileName.split('.').pop()?.toLowerCase() ?? 'bin';
    const sanitizedExtension = rawExtension.replace(/[^a-z0-9]/g, '');

    return sanitizedExtension || 'bin';
  }
}
