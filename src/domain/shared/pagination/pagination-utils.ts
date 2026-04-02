import type { PaginatedResult, PaginationParams } from './pagination-params'

export const DEFAULT_PAGE = 1
export const DEFAULT_PER_PAGE = 20
export const MAX_PER_PAGE = 100

export const normalizePaginationParams = (params?: PaginationParams) => {
  const page = Math.max(DEFAULT_PAGE, Number(params?.page ?? DEFAULT_PAGE) || DEFAULT_PAGE)
  const perPage = Math.min(
    MAX_PER_PAGE,
    Math.max(1, Number(params?.perPage ?? DEFAULT_PER_PAGE) || DEFAULT_PER_PAGE),
  )

  return { page, perPage }
}

export const createPaginatedResult = <T>(
  items: T[],
  total: number,
  params?: PaginationParams,
): PaginatedResult<T> => {
  const { page, perPage } = normalizePaginationParams(params)

  return {
    items,
    total,
    page,
    perPage,
  }
}

export const paginateItems = <T>(items: T[], params?: PaginationParams): PaginatedResult<T> => {
  const { page, perPage } = normalizePaginationParams(params)
  const start = (page - 1) * perPage
  const pagedItems = items.slice(start, start + perPage)

  return {
    items: pagedItems,
    total: items.length,
    page,
    perPage,
  }
}

export const toPaginationMeta = <T>(result: PaginatedResult<T>) => ({
  page: result.page,
  perPage: result.perPage,
  total: result.total,
})
