import { describe, expect, it } from '@jest/globals';
import { isValidCpf } from './cpf';

describe('CPF algorithm', () => {
  it('validates the verifier digits', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('111.444.777-35')).toBe(true);
  });

  it('rejects impossible documents and invalid input shapes', () => {
    for (const cpf of [
      '', '00000000000', '111.111.111-11', '529.982.247-26',
      '12345678901', '529.982.247', '529 982 247 25',
    ]) {
      expect(isValidCpf(cpf)).toBe(false);
    }
  });
});
