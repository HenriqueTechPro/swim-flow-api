import type { Provider } from '@nestjs/common';
import { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import { ManagedUploadResourcesRepository } from '@/domain/uploads/application/repositories/managed-upload-resources-repository';
import { StorePrivateBlobImageUseCase } from '@/domain/uploads/application/use-cases/store-private-blob-image';
import { PrismaPrivateMediaObjectsRepository } from '@/infra/database/prisma/repositories/prisma-private-media-objects-repository';
import { PrismaService } from '@/infra/database/prisma/prisma.service';
import { loadPrivateVercelBlobConfig } from '@/infra/storage/private-vercel-blob-config';
import { createVercelPrivateBlobStorageRepository } from '@/infra/storage/private-vercel-blob-storage.repository';
import { SharpPrivateBlobImageProcessor } from '@/infra/storage/sharp-private-blob-image-processor';
import { PrivateImageUploadService } from './private-image-upload.service';

export const privateImageUploadProvider: Provider = {
  provide: PrivateImageUploadService,
  inject: [
    AuthProfilesRepository,
    ManagedUploadResourcesRepository,
    PrismaService,
  ],
  useFactory: (
    profiles: AuthProfilesRepository,
    resources: ManagedUploadResourcesRepository,
    prisma: PrismaService,
  ): PrivateImageUploadService => {
    const config = loadPrivateVercelBlobConfig(process.env);
    if (!config) return new PrivateImageUploadService(null);

    return new PrivateImageUploadService(
      new StorePrivateBlobImageUseCase(
        profiles,
        resources,
        new SharpPrivateBlobImageProcessor(),
        createVercelPrivateBlobStorageRepository(config),
        new PrismaPrivateMediaObjectsRepository(prisma),
      ),
    );
  },
};
