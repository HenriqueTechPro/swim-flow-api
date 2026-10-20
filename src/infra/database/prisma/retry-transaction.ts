import { Prisma } from '@prisma/client';

// Transactions must be entirely atomic and have no external side effects
// (emails, storage uploads, payments, etc.). Never use this for arbitrary
// mutations: retry only when the first attempt was rolled back by the DB.
const MAX_TRANSACTION_ATTEMPTS = 2;

/** Retry a fully rolled-back Prisma transaction at most once on P2034. */
export async function retryRolledBackTransaction<T>(
  runTransaction: () => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await runTransaction();
    } catch (error) {
      if (
        attempt >= MAX_TRANSACTION_ATTEMPTS ||
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2034'
      ) {
        throw error;
      }
      // Re-run the ENTIRE transaction, including fresh reads and CAS checks.
    }
  }
}
