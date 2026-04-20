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
  teacher: [
    'students:read',
    'students:write',
    'attendance:read',
    'attendance:write',
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
  ],
  user: ['uploads:write'],
};

export function getPermissionsForRole(role: AppRole): AppPermission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
