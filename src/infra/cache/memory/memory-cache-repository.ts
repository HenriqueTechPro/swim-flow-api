import { Injectable } from '@nestjs/common';
import { CacheRepository } from '../cache-repository';

type CacheEntry = {
  value: string;
  expiresAt: number | null;
};

@Injectable()
export class MemoryCacheRepository implements CacheRepository {
  private readonly store = new Map<string, CacheEntry>();

  set(key: string, value: string, ttlInSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlInSeconds ? Date.now() + ttlInSeconds * 1000 : null,
    });
    return Promise.resolve();
  }

  get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return Promise.resolve(null);

    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return Promise.resolve(null);
    }

    return Promise.resolve(entry.value);
  }

  delete(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }

  deleteMatching(prefix: string): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
    return Promise.resolve();
  }
}
