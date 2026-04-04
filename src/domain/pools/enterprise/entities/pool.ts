export interface Pool {
  id: string
  name: string
  lengthMeters: number
  address: string
  status: 'Ativa' | 'Inativa' | 'Manutenção'
  maxCapacity?: number | null
  createdAt: string
  updatedAt: string
}
