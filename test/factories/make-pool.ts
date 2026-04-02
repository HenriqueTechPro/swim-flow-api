import type { Pool } from '@/domain/pools/enterprise/entities/pool'

interface MakePoolOverride extends Partial<Pool> {}

export function makePool(override: MakePoolOverride = {}): Pool {
  return {
    id: override.id ?? crypto.randomUUID(),
    name: override.name ?? 'Piscina Teste',
    lengthMeters: override.lengthMeters ?? 25,
    address: override.address ?? 'Rua das Piscinas, 100',
    status: override.status ?? 'Ativa',
    maxCapacity: override.maxCapacity ?? 40,
    createdAt: override.createdAt ?? '2026-03-31T00:00:00.000Z',
    updatedAt: override.updatedAt ?? '2026-03-31T00:00:00.000Z',
  }
}
