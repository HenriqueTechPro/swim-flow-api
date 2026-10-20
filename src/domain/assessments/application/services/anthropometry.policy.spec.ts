import { AnthropometryPolicy } from './anthropometry.policy';

describe('AnthropometryPolicy', () => {
  it('keeps unavailable derived measurements null instead of inventing zeroes', () => {
    const result = AnthropometryPolicy.validateAndDerive({ heightCm: 143 });

    expect(result.bodyMassIndex).toBeNull();
    expect(result.armSpanMinusHeightCm).toBeNull();
  });

  it('derives BMI and arm-span difference from consistent metric units', () => {
    const result = AnthropometryPolicy.validateAndDerive({
      heightCm: 150,
      bodyMassKg: 45,
      armSpanCm: 154,
    });

    expect(result.bodyMassIndex).toBeCloseTo(20, 5);
    expect(result.armSpanMinusHeightCm).toBe(4);
  });

  it.each([
    { heightCm: 0 },
    { bodyMassKg: -1 },
    { footLengthCm: Number.POSITIVE_INFINITY },
    { legLengthCm: Number.NaN },
  ])('rejects invalid measurement %j', (measurements) => {
    expect(() => AnthropometryPolicy.validateAndDerive(measurements)).toThrow();
  });

  it('rejects evaluations without any recorded measurement', () => {
    expect(() =>
      AnthropometryPolicy.validateAndDerive({
        heightCm: null,
        bodyMassKg: undefined,
      }),
    ).toThrow('At least one physical measurement');
  });

  it('does not require both mass and height for a partial evaluation', () => {
    expect(
      AnthropometryPolicy.validateAndDerive({ footLengthCm: 22.5 })
        .bodyMassIndex,
    ).toBeNull();
  });
});
