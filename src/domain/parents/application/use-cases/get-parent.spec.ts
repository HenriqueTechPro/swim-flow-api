import { beforeEach, describe, expect, it } from '@jest/globals';
import { GetParentUseCase } from './get-parent';
import { InMemoryParentsRepository } from '../../../../../test/repositories/in-memory-parents-repository';
import { makeParent } from '../../../../../test/factories/make-parent';

describe('GetParentUseCase', () => {
  let repo: InMemoryParentsRepository;
  let useCase: GetParentUseCase;

  beforeEach(() => {
    repo = new InMemoryParentsRepository();
    useCase = new GetParentUseCase(repo);
  });

  it('fetches only the requested parent and preserves linked children', async () => {
    const a = makeParent({ name: 'Responsavel A', childrenIds: ['child-a'] });
    const b = makeParent({ name: 'Responsavel B', childrenIds: ['child-b'] });
    repo.items.push(a, b);

    const { parent } = await useCase.execute(b.id);
    expect(parent.id).toBe(b.id);
    expect(parent.childrenIds).toEqual(['child-b']);
  });

  it('responds with 404 if the parent does not exist', async () => {
    await expect(
      useCase.execute('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
