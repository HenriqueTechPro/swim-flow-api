import { getCategoryByBirthYear } from './categories';

describe('getCategoryByBirthYear', () => {
  it('classifies the same athlete in the correct reference seasons', () => {
    expect(getCategoryByBirthYear(2017, 2026)).toBe('Mirim 1');
    expect(getCategoryByBirthYear(2017, 2027)).toBe('Mirim 2');
    expect(getCategoryByBirthYear(2017, 2028)).toBe('Petiz 1');
  });

  it('does not use a hard-coded 2026 reference', () => {
    const currentYear = new Date().getUTCFullYear();
    expect(getCategoryByBirthYear(currentYear - 11)).toBe('Petiz 1');
  });

  it('separates Junior, Senior and Master by reference-year age', () => {
    expect(getCategoryByBirthYear(2004, 2026)).toBe('Senior');
    expect(getCategoryByBirthYear(1997, 2026)).toBe('Master A');
  });

  it.each([
    [2027, 2026],
    [0, 2026],
    [2012.5, 2026],
    [2010, Number.NaN],
  ])('rejects invalid birth/reference years (%s, %s)', (born, year) => {
    expect(() => getCategoryByBirthYear(born, year)).toThrow(RangeError);
  });
});
