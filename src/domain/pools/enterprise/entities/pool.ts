export interface Pool {
  id: string
  name: string
  lengthMeters: number
  address: string
  status: 'Ativa' | 'Pausada' | 'Encerrada'
  maxCapacity?: number | null
  createdAt: string
  updatedAt: string
}
