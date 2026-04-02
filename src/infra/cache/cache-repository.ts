export abstract class CacheRepository {
  abstract set(key: string, value: string, ttlInSeconds?: number): Promise<void>
  abstract get(key: string): Promise<string | null>
  abstract delete(key: string): Promise<void>
  abstract deleteMatching(prefix: string): Promise<void>
}
