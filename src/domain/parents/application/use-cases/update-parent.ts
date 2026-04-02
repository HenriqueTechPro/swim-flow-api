import { Injectable } from '@nestjs/common'
import type { UpdateParentRequest } from '../dtos/parent-requests'
import { ParentsRepository } from '../repositories/parents-repository'

@Injectable()
export class UpdateParentUseCase {
  constructor(private readonly parentsRepository: ParentsRepository) {}

  async execute(id: string, input: UpdateParentRequest) {
    const parent = await this.parentsRepository.update(id, input)
    return { parent }
  }
}
