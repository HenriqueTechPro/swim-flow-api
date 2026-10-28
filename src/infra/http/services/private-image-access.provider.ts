import type { Provider } from '@nestjs/common';
import { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import { ManagedUploadResourcesRepository } from '@/domain/uploads/application/repositories/managed-upload-resources-repository';
import { AssignPrivateBlobImageUseCase } from '@/domain/uploads/application/use-cases/assign-private-blob-image';
import { ReadPrivateBlobImageUseCase } from '@/domain/uploads/application/use-cases/read-private-blob-image';
import { ListActivePrivateBlobReferencesUseCase } from '@/domain/uploads/application/use-cases/list-active-private-blob-references';
import { PrismaPrivateMediaObjectsRepository } from '@/infra/database/prisma/repositories/prisma-private-media-objects-repository';
import { PrismaService } from '@/infra/database/prisma/prisma.service';
import { loadPrivateVercelBlobConfig } from '@/infra/storage/private-vercel-blob-config';
import { createVercelPrivateBlobStorageRepository } from '@/infra/storage/private-vercel-blob-storage.repository';
import { PrivateImageAccessService } from './private-image-access.service';

export const privateImageAccessProvider: Provider = {
  provide: PrivateImageAccessService,
  inject: [
    AuthProfilesRepository,
    ManagedUploadResourcesRepository,
    PrismaService,
  ],
  useFactory: (
    profiles: AuthProfilesRepository,
    resources: ManagedUploadResourcesRepository,
    prisma: PrismaService,
  ): PrivateImageAccessService => {
    const config = loadPrivateVercelBlobConfig(process.env);
    if (!config) return new PrivateImageAccessService(null, null);

    const records = new PrismaPrivateMediaObjectsRepository(prisma);
    return new PrivateImageAccessService(
      new AssignPrivateBlobImageUseCase(profiles, resources, records),
      new ReadPrivateBlobImageUseCase(
        profiles,
        resources,
        records,
        createVercelPrivateBlobStorageRepository(config),
      ),
      new ListActivePrivateBlobReferencesUseCase(profiles, records),
    );
  },
};
