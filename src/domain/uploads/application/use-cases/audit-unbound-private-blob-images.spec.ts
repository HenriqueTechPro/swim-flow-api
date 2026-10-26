import type { PrivateMediaObjectsRepository } from '../repositories/private-media-objects-repository';
import {
  AuditUnboundPrivateBlobImagesUseCase,
  MIN_PRIVATE_BLOB_RETENTION_DAYS,
  PRIVATE_BLOB_AUDIT_BATCH_SIZE,
} from './audit-unbound-private-blob-images';

const NOW = new Date('2026-10-26T12:00:00.000Z');
const CUTOFF = new Date('2026-09-26T12:00:00.000Z');
const oldRow = (i: number) => ({
  id: `media-id-${i}`,
  target: 'student-photo' as const,
  declaredSizeBytes: 120,
  verifiedAt: new Date('2026-09-01T12:00:00.000Z'),
});

function setup(rows = [oldRow(0)]) {
  const records = {
    listUnboundVerifiedBlobCandidates: jest.fn().mockResolvedValue(rows),
  };
  const audit = new AuditUnboundPrivateBlobImagesUseCase(
    records as unknown as PrivateMediaObjectsRepository,
  );
  return { audit, records };
}

describe('Read-only, 30-day Blob orphan audit (zero Blob/network calls)', () => {
  it('uses fixed retention and reports sample without paths, ETags or IDs', async () => {
    const { audit, records } = setup();
    const result = await audit.execute(NOW);
    expect(records.listUnboundVerifiedBlobCandidates).toHaveBeenCalledWith(
      CUTOFF,
      PRIVATE_BLOB_AUDIT_BATCH_SIZE + 1,
    );
    expect(MIN_PRIVATE_BLOB_RETENTION_DAYS).toBe(30);
    expect(result).toEqual({
      mode: 'DRY_RUN',
      retentionDays: 30,
      cutoff: CUTOFF.toISOString(),
      sampledCandidates: 1,
      hasMoreCandidates: false,
      estimatedBytesInSample: 120,
      byTarget: { 'student-photo': 1 },
      deletedObjects: 0,
    });
    expect(JSON.stringify(result)).not.toContain('media-id');
    expect(JSON.stringify(result)).not.toContain('private/');
  });

  it('caps sample and reports when more rows need independent review', async () => {
    const { audit } = setup(Array.from({ length: 26 }, (_, i) => oldRow(i)));
    const result = await audit.execute(NOW);
    expect(result.sampledCandidates).toBe(25);
    expect(result.estimatedBytesInSample).toBe(3000);
    expect(result.hasMoreCandidates).toBe(true);
    expect(result.deletedObjects).toBe(0);
  });

  it('never assumes candidates remain safe after query; query result only', async () => {
    const { audit, records } = setup([]);
    expect(await audit.execute(NOW)).toMatchObject({
      sampledCandidates: 0,
      hasMoreCandidates: false,
      deletedObjects: 0,
    });
    expect(records.listUnboundVerifiedBlobCandidates).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid dates and malformed metadata before reporting', async () => {
    const { audit, records } = setup();
    await expect(audit.execute(new Date('invalid'))).rejects.toThrow(
      'invalid-private-blob-audit-date',
    );
    expect(records.listUnboundVerifiedBlobCandidates).not.toHaveBeenCalled();
    records.listUnboundVerifiedBlobCandidates.mockResolvedValueOnce([
      { ...oldRow(0), declaredSizeBytes: -1 },
    ]);
    await expect(audit.execute(NOW)).rejects.toThrow(
      'invalid-private-blob-audit-record',
    );
    records.listUnboundVerifiedBlobCandidates.mockResolvedValueOnce([
      { ...oldRow(0), verifiedAt: new Date('2026-10-25T12:00:00.000Z') },
    ]);
    await expect(audit.execute(NOW)).rejects.toThrow(
      'invalid-private-blob-audit-record',
    );
  });

  it('refuses to return raw storage keys, secrets, file names or media IDs', async () => {
    const { audit } = setup([{
      ...oldRow(0),
      objectKey: 'private/students/secret/profile.jpg',
      verifiedEtag: '"etag"',
    }]);
    const result = await audit.execute(NOW);
    expect(JSON.stringify(result)).not.toContain('objectKey');
    expect(JSON.stringify(result)).not.toContain('etag');
    expect(JSON.stringify(result)).not.toContain('secret');
  });
});
