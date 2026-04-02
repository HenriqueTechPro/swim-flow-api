import { Injectable } from '@nestjs/common'
import { ParentsRepository } from '../repositories/parents-repository'

@Injectable()
export class DeleteParentUseCase {
  constructor(private readonly parentsRepository: ParentsRepository) {}

  async execute(id: string) {
    const parent = await this.parentsRepository.remove(id)
    return { parent }
  }
}
