export interface CreatePoolRequest {
  name: string
  lengthMeters: number
  address: string
  status: 'Ativa' | 'Pausada' | 'Encerrada'
  maxCapacity?: number | null
}

export interface UpdatePoolRequest extends CreatePoolRequest {}
