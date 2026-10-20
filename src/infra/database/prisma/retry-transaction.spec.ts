import { Prisma } from '@prisma/client';
import { retryRolledBackTransaction } from './retry-transaction';

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('Sensitive DB operation', {
    code, clientVersion: '6.19.3',
  });
}

describe('retryRolledBackTransaction', () => {
  it('returns the first successful transaction result', async () => {
    const run = jest.fn().mockResolvedValue('committed');
    await expect(retryRolledBackTransaction(run)).resolves.toBe('committed');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('re-runs a fully rolled-back P2034 transaction exactly once', async () => {
    const run = jest.fn()
      .mockRejectedValueOnce(prismaError('P2034'))
      .mockResolvedValueOnce('committed');
    await expect(retryRolledBackTransaction(run)).resolves.toBe('committed');
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('rejects after a second P2034 without an unbounded retry loop', async () => {
    const error = prismaError('P2034');
    const run = jest.fn().mockRejectedValue(error);
    await expect(retryRolledBackTransaction(run)).rejects.toBe(error);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it.each(['P2002', 'P2003', 'P2025'])(
    'never retries %s because the transaction is not safely replayable',
    async (code) => {
      const error = prismaError(code);
      const run = jest.fn().mockRejectedValue(error);
      await expect(retryRolledBackTransaction(run)).rejects.toBe(error);
      expect(run).toHaveBeenCalledTimes(1);
    },
  );

  it('never retries application errors or unrelated failures', async () => {
    const error = new Error('Email delivery failed');
    const run = jest.fn().mockRejectedValue(error);
    await expect(retryRolledBackTransaction(run)).rejects.toBe(error);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
