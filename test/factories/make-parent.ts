import type { Parent } from '@/domain/parents/enterprise/entities/parent'

interface MakeParentOverride extends Partial<Parent> {}

export function makeParent(override: MakeParentOverride = {}): Parent {
  return {
    id: override.id ?? crypto.randomUUID(),
    name: override.name ?? 'Responsavel Teste',
    photo: override.photo,
    cpf: override.cpf ?? '987.654.321-00',
    birthDate: override.birthDate ?? '1985-08-20',
    childrenIds: override.childrenIds ?? [],
    children: override.children ?? [],
    phone: override.phone ?? '(71) 98888-2222',
    email: override.email ?? 'responsavel.teste@example.com',
    profession: override.profession ?? 'Analista',
    address: override.address ?? 'Rua das Piscinas, 123',
    emergencyContact: override.emergencyContact ?? 'Contato Emergencial',
    emergencyPhone: override.emergencyPhone ?? '(71) 97777-1111',
    status: override.status ?? 'Ativo',
  }
}
