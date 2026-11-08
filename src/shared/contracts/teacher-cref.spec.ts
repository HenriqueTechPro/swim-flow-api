import { describe, expect, it } from '@jest/globals';
import { teacherCrefSchema } from './management';

describe('Professional CREF registration contract', () => {
  it('normalizes primary and secondary professional registration formats', () => {
    expect(teacherCrefSchema.parse('cref 000123-g/ba')).toBe('000123-G/BA');
    expect(teacherCrefSchema.parse('000123-P/BA')).toBe('000123-P/BA');
    expect(teacherCrefSchema.parse('000123-G/BA-S')).toBe('000123-G/BA-S');
  });

  it('preserves optional legacy records and rejects malformed values', () => {
    expect(teacherCrefSchema.parse(undefined)).toBeUndefined();
    expect(teacherCrefSchema.parse(null)).toBeNull();
    for (const value of ['CREF', '123-G/BA', '000123-X/BA', '000123-G/BBB']) {
      expect(teacherCrefSchema.safeParse(value).success).toBe(false);
    }
  });
});
