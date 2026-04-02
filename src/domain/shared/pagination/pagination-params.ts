export interface PaginationParams {
  page?: number
  perPage?: number
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  perPage: number
}
