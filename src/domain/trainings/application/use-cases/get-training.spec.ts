import { beforeEach, describe, expect, it } from '@jest/globals';
import { GetTrainingUseCase } from './get-training';
import { InMemoryTrainingsRepository } from '../../../../../test/repositories/in-memory-trainings-repository';
import { makeTraining } from '../../../../../test/factories/make-training';

describe('GetTrainingUseCase', () => {
  let repository: InMemoryTrainingsRepository;
  let sut: GetTrainingUseCase;

  beforeEach(() => {
    repository = new InMemoryTrainingsRepository();
    sut = new GetTrainingUseCase(repository);
  });

  it('loads the requested UUID instead of listing the entire catalog', async () => {
    const first = makeTraining({ title: 'Training A' });
    const second = makeTraining({ title: 'Training B' });
    repository.items.push(first, second);

    const { training } = await sut.execute(second.id);
    expect(training.id).toBe(second.id);
    expect(training.title).toBe('Training B');
  });

  it('returns 404 for an unknown UUID', async () => {
    await expect(
      sut.execute('11111111-1111-4111-8111-111111111111'),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
