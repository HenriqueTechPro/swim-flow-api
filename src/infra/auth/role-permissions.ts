import type {
  AppPermission,
  AppRole,
} from '@/domain/auth/application/auth.types';

const RESOURCE_PERMISSIONS: AppPermission[] = [
  'students:read',
  'students:write',
  'attendance:read',
  'attendance:write',
  'auth:invite',
  'auth:manage-users',
  'classes:read',
  'classes:write',
  'events:read',
  'events:write',
  'ex-students:read',
  'ex-students:write',
  'parents:read',
  'parents:write',
  'pools:read',
  'pools:write',
  'results:read',
  'results:write',
  'teachers:read',
  'teachers:write',
  'trainings:read',
  'trainings:write',
  'uploads:write',
];

const ROLE_PERMISSIONS: Record<AppRole, AppPermission[]> = {
  admin: RESOURCE_PERMISSIONS,
  // Scoped reads only. Every other resource must be administrator-only
  // until its queries and mutations have record-level authorization.
  teacher: [
    'students:read',
    'classes:read',
    'attendance:read',
    'attendance:write',
  ],
  user: ['uploads:write'],
};

export function getPermissionsForRole(role: AppRole): AppPermission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
