import { Module } from '@nestjs/common'
import { HashComparer } from '@/domain/auth/application/cryptography/hash-comparer'
import { HashGenerator } from '@/domain/auth/application/cryptography/hash-generator'
import { BcryptHasher } from './bcrypt-hasher'

@Module({
  providers: [
    { provide: HashGenerator, useClass: BcryptHasher },
    { provide: HashComparer, useClass: BcryptHasher },
  ],
  exports: [HashGenerator, HashComparer],
})
export class CryptographyModule {}
