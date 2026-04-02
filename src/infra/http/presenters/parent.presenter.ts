import type { Parent } from '@/domain/parents/enterprise/entities/parent'

export class ParentPresenter {
  static toHTTP(parent: Parent) {
    return {
      id: parent.id,
      name: parent.name,
      photo: parent.photo,
      cpf: parent.cpf,
      birthDate: parent.birthDate,
      childrenIds: parent.childrenIds,
      children: parent.children,
      phone: parent.phone,
      email: parent.email,
      profession: parent.profession,
      address: parent.address,
      emergencyContact: parent.emergencyContact,
      emergencyPhone: parent.emergencyPhone,
      status: parent.status,
    }
  }
}
