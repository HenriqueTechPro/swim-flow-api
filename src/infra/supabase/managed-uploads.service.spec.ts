import { ServiceUnavailableException } from '@nestjs/common';
import { EnvService } from '@/infra/env/env.service';
import { SupabaseManagedUploadsRepository } from './managed-uploads.service';

describe('SupabaseManagedUploadsRepository without storage configuration', () => {
  it('rejects signed uploads when credentials are absent', async () => {
    const env = {
      supabaseUrl: undefined,
      supabaseServiceRoleKey: null,
    } as unknown as EnvService;
    const uploads = new SupabaseManagedUploadsRepository(env);

    await expect(
      uploads.createSignedUpload('test-user', {
        target: 'profile-avatar',
        fileName: 'photo.png',
        contentType: 'image/png',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects signed uploads when a role key exists without a URL', async () => {
    const env = {
      supabaseUrl: undefined,
      supabaseServiceRoleKey: 'legacy-key',
    } as unknown as EnvService;
    const uploads = new SupabaseManagedUploadsRepository(env);

    await expect(
      uploads.createSignedUpload('test-user', {
        target: 'profile-avatar',
        fileName: 'photo.png',
        contentType: 'image/png',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
