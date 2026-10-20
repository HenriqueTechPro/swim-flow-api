import { ExStudentsController } from './ex-students.controller';
import { ROLES_KEY } from '@/infra/auth/roles.decorator';

describe('ExStudentsController access policy', () => {
  it('requires admin while teacher-to-student scoped access is unavailable', () => {
    expect(Reflect.getMetadata(ROLES_KEY, ExStudentsController)).toEqual([
      'admin',
    ]);
  });
});
