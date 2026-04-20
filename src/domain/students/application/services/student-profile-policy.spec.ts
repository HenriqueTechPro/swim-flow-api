import { describe, expect, it } from '@jest/globals';
import { AppError } from '@/shared/errors/app-error';
import { StudentProfilePolicy } from './student-profile-policy';

describe('StudentProfilePolicy', () => {
  const referenceData = {
    categories: [{ id: 'cat-pre-mirim', name: 'Pre_Mirim' }],
    levels: [
      { id: 'level-1', name: 'Iniciante' },
      { id: 'level-2', name: 'Intermediário' },
    ],
  };

  it('resolves category and level ids for persistence', () => {
    const result = StudentProfilePolicy.resolvePersistenceInput(
      {
        name: 'Aluno da API',
        gender: 'Masculino',
        birthDate: '2018-05-10',
        level: 'Iniciante',
        parentId: null,
        classId: null,
        phone: '(71) 99999-1111',
        status: 'Ativo',
        photo: null,
      },
      referenceData,
    );

    expect(result.categoryId).toBe('cat-pre-mirim');
    expect(result.levelId).toBe('level-1');
  });

  it('matches level names ignoring accents and casing', () => {
    const result = StudentProfilePolicy.resolvePersistenceInput(
      {
        name: 'Aluno da API',
        gender: 'Masculino',
        birthDate: '2018-05-10',
        level: 'intermediario',
        parentId: null,
        classId: null,
        phone: '(71) 99999-1111',
        status: 'Ativo',
        photo: null,
      },
      referenceData,
    );

    expect(result.levelId).toBe('level-2');
  });

  it('matches double-encoded legacy level names', () => {
    const result = StudentProfilePolicy.resolvePersistenceInput(
      {
        name: 'Aluno da API',
        gender: 'Masculino',
        birthDate: '2018-05-10',
        level: 'IntermediÃ¡rio',
        parentId: null,
        classId: null,
        phone: '(71) 99999-1111',
        status: 'Ativo',
        photo: null,
      },
      referenceData,
    );

    expect(result.levelId).toBe('level-2');
  });

  it('throws when level is not available', () => {
    expect(() =>
      StudentProfilePolicy.resolvePersistenceInput(
        {
          name: 'Aluno da API',
          gender: 'Masculino',
          birthDate: '2018-05-10',
          level: 'Elite',
          parentId: null,
          classId: null,
          phone: '(71) 99999-1111',
          status: 'Ativo',
          photo: null,
        },
        referenceData,
      ),
    ).toThrow(AppError);
  });
});
