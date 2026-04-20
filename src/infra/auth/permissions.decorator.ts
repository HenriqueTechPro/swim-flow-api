import { SetMetadata } from '@nestjs/common';
import type { AppPermission } from '@/domain/auth/application/auth.types';

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: AppPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
