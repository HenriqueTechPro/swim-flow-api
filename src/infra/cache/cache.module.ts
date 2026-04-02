import { Module } from '@nestjs/common'
import { CacheRepository } from './cache-repository'
import { MemoryCacheRepository } from './memory/memory-cache-repository'

@Module({
  providers: [
    {
      provide: CacheRepository,
      useClass: MemoryCacheRepository,
    },
  ],
  exports: [CacheRepository],
})
export class CacheModule {}
