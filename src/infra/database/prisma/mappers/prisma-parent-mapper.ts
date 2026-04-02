import type { Parent } from '@/domain/parents/enterprise/entities/parent'

export interface PrismaParentRecord {
  id: string
  name: string
  photo: string | null
  cpf: string | null
  birthDate: Date | null
  phone: string
  email: string
  profession: string
  address: string
  emergencyContact: string
  emergencyPhone: string
  status: string
  students: Array<{
    id: string
    name: string
  }>
}

export class PrismaParentMapper {
  static toDomain(parent: PrismaParentRecord): Parent {
    return {
      id: parent.id,
      name: parent.name,
      photo: parent.photo ?? undefined,
      cpf: parent.cpf ?? undefined,
      birthDate: parent.birthDate ? parent.birthDate.toISOString().slice(0, 10) : undefined,
      childrenIds: parent.students.map((student) => student.id),
      children: parent.students.map((student) => student.name),
      phone: parent.phone,
      email: parent.email,
      profession: parent.profession,
      address: parent.address,
      emergencyContact: parent.emergencyContact,
      emergencyPhone: parent.emergencyPhone,
      status: parent.status === 'Inativo' ? 'Inativo' : 'Ativo',
    }
  }
}
