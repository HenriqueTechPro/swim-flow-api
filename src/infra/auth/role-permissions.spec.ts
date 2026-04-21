import { describe, expect, it } from '@jest/globals';
import { getPermissionsForRole } from './role-permissions';

describe('getPermissionsForRole', () => {
  it('grants the full management permission set to admins', () => {
    expect(getPermissionsForRole('admin')).toEqual([
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
    ]);
  });

  it('grants the expected management permissions to teachers', () => {
    expect(getPermissionsForRole('teacher')).toEqual([
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
    ]);
  });

  it('keeps regular users limited to self-service uploads', () => {
    expect(getPermissionsForRole('user')).toEqual(['uploads:write']);
  });
});
