import type { CreateParentDto, UpdateParentDto } from '@/shared/contracts/management'
import type { CreateParentRequest, UpdateParentRequest } from '@/domain/parents/application/dtos/parent-requests'

export class ParentRequestMapper {
  static toCreate(body: CreateParentDto): CreateParentRequest {
    return {
      name: body.name,
      cpf: body.cpf ?? null,
      birthDate: body.birthDate ?? null,
      photo: body.photo ?? null,
      childrenIds: body.childrenIds,
      email: body.email,
      phone: body.phone,
      profession: body.profession,
      address: body.address,
      emergencyContact: body.emergencyContact,
      emergencyPhone: body.emergencyPhone,
      status: body.status,
    }
  }

  static toUpdate(body: UpdateParentDto): UpdateParentRequest {
    return {
      name: body.name,
      cpf: body.cpf ?? null,
      birthDate: body.birthDate ?? null,
      photo: body.photo ?? null,
      childrenIds: body.childrenIds,
      email: body.email,
      phone: body.phone,
      profession: body.profession,
      address: body.address,
      emergencyContact: body.emergencyContact,
      emergencyPhone: body.emergencyPhone,
      status: body.status,
    }
  }
}
