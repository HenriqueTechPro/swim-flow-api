import { Injectable } from '@nestjs/common'
import type { CreateParentRequest } from '../dtos/parent-requests'
import { ParentsRepository } from '../repositories/parents-repository'

@Injectable()
export class CreateParentUseCase {
  constructor(private readonly parentsRepository: ParentsRepository) {}

  async execute(input: CreateParentRequest) {
    const parent = await this.parentsRepository.create(input)
    return { parent }
  }
}
