import { describe, expect, it } from '@jest/globals';
import { updateResultSchema } from '@/shared/contracts/management';
import { ResultRequestMapper } from './result-request.mapper';

const baseResult = {
  studentId: '4fa17f23-ff79-47ea-9ebf-9e335816ed8e',
  style: 'Livre' as const,
  distance: '1500m',
  time: '00:25:40.00',
  date: '2026-11-04',
  competition: 'Festival',
  category: 'Master',
  resultStatus: 'Classificado' as const,
};

describe('ResultRequestMapper.toUpdate', () => {
  it('preserva o comprimento oficial da piscina na edicao', () => {
    const body = updateResultSchema.parse({
      ...baseResult,
      discipline: 'Piscina',
      competitionType: 'Piscina',
      courseType: 'Piscina Longa',
      eventFormat: 'Prova Individual',
      poolLengthMeters: 50,
    });

    const request = ResultRequestMapper.toUpdate(body);
    expect(request.poolLengthMeters).toBe(50);
    expect(request.routeKey).toBeUndefined();
  });

  it('preserva e normaliza a identificacao de percurso nas aguas abertas', () => {
    const body = updateResultSchema.parse({
      ...baseResult,
      discipline: 'Aguas Abertas',
      competitionType: 'Aguas Abertas',
      courseType: 'Mar',
      eventFormat: 'Travessia',
      routeKey: '  Circuito Norte  ',
    });

    const request = ResultRequestMapper.toUpdate(body);
    expect(request.routeKey).toBe('Circuito Norte');
    expect(request.poolLengthMeters).toBeUndefined();
  });

  it('nao inventa campos de percurso quando ausentes', () => {
    const body = updateResultSchema.parse({
      ...baseResult,
      discipline: 'Aguas Abertas',
      competitionType: 'Aguas Abertas',
      courseType: 'Mar',
      eventFormat: 'Travessia',
    });

    const request = ResultRequestMapper.toUpdate(body);
    expect(request.routeKey).toBeUndefined();
    expect(request.poolLengthMeters).toBeUndefined();
  });

  it('mantem a validacao contra contextos de prova inconsistentes', () => {
    expect(() => updateResultSchema.parse({
      ...baseResult,
      discipline: 'Piscina',
      competitionType: 'Piscina',
      courseType: 'Piscina Curta',
      eventFormat: 'Prova Individual',
      poolLengthMeters: 50,
    })).toThrow();
    expect(() => updateResultSchema.parse({
      ...baseResult,
      discipline: 'Aguas Abertas',
      competitionType: 'Aguas Abertas',
      courseType: 'Mar',
      eventFormat: 'Travessia',
      poolLengthMeters: 25,
    })).toThrow();
  });
});
