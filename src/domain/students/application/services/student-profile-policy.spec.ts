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

  it('uses the active season year instead of a fixed year', () => {
    const result = StudentProfilePolicy.resolvePersistenceInput(
      {
        name: 'Aluno da API',
        gender: 'Masculino',
        birthDate: '2018-05-10',
        level: 'Iniciante',
        phone: '(71) 99999-1111',
        status: 'Ativo',
      },
      {
        categories: [{ id: 'cat-mirim-1', name: 'Mirim_1' }],
        levels: referenceData.levels,
        activeSeasonYear: 2027,
        activeSeasonId: 'season-2027',
      },
    );

    expect(result.categoryId).toBe('cat-mirim-1');
    expect(result.seasonId).toBe('season-2027');
  });

  it.each(['2026-02-30', '2026-13-04', 'not-a-date', '2099-01-01'])(
    'rejects invalid or future birth dates: %s',
    (birthDate) => {
      expect(() =>
        StudentProfilePolicy.resolvePersistenceInput(
          {
            name: 'Aluno da API',
            gender: 'Masculino',
            birthDate,
            level: 'Iniciante',
            phone: '(71) 99999-1111',
            status: 'Ativo',
          },
          referenceData,
        ),
      ).toThrow('Invalid or future student birth date');
    },
  );

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
