export interface CreatePoolRequest {
  name: string
  lengthMeters: number
  address: string
  status: 'Ativa' | 'Inativa' | 'Manutenção'
  maxCapacity?: number | null
}

export interface UpdatePoolRequest extends CreatePoolRequest {}
