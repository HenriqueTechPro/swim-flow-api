import { describe, expect, it } from '@jest/globals'
import { BcryptHasher } from './bcrypt-hasher'

describe('BcryptHasher', () => {
  it('hashes and compares values', async () => {
    const sut = new BcryptHasher()

    const hashed = await sut.hash('secret-123')

    expect(hashed).not.toBe('secret-123')
    await expect(sut.compare('secret-123', hashed)).resolves.toBe(true)
    await expect(sut.compare('wrong-secret', hashed)).resolves.toBe(false)
  })
})
