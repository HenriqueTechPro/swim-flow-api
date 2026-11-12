import 'reflect-metadata';
import { ROLES_KEY } from '@/infra/auth/roles.decorator';
import { StudentsController } from './students.controller';

describe('StudentsController hard-delete authorization', () => {
  it('reserves physical deletion for admins, not teachers', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, StudentsController.prototype.remove),
    ).toEqual(['admin']);
  });
});
