/** CPF format and checksum validation for inbound API requests. */
const CPF_PATTERN = /^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/;

export function isValidCpf(value: string): boolean {
  if (!CPF_PATTERN.test(value)) return false;

  const digits = value.replace(/\D/g, '');
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const expectedDigit = (length: number): number => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return (
    expectedDigit(9) === Number(digits[9]) &&
    expectedDigit(10) === Number(digits[10])
  );
}
