export const REFERENCE_YEAR = 2026

export type SwimmingCategory =
  | 'Pré-Mirim'
  | 'Mirim 1'
  | 'Mirim 2'
  | 'Petiz 1'
  | 'Petiz 2'
  | 'Infantil 1'
  | 'Infantil 2'
  | 'Juvenil 1'
  | 'Juvenil 2'
  | 'Júnior 1'
  | 'Júnior 2'
  | 'Sênior'
  | 'Pré-Master'
  | 'Master A'
  | 'Master B'
  | 'Master C'
  | 'Master D'
  | 'Master E'
  | 'Master F'
  | 'Master G'
  | 'Master H'
  | 'Master I'
  | 'Master J'
  | 'Master K'
  | 'Master L'
  | 'Master M'
  | 'Master N'
  | 'Master O'

export const TEACHER_CATEGORY_OPTIONS: string[] = [
  'Pré-Mirim',
  'Mirim',
  'Petiz',
  'Infantil',
  'Juvenil',
  'Júnior',
  'Sênior',
  'Master',
]

export const CATEGORY_GROUPS = [
  { label: 'Pré-Mirim', categories: ['Pré-Mirim'] as SwimmingCategory[] },
  { label: 'Mirim', categories: ['Mirim 1', 'Mirim 2'] as SwimmingCategory[] },
  { label: 'Petiz', categories: ['Petiz 1', 'Petiz 2'] as SwimmingCategory[] },
  { label: 'Infantil', categories: ['Infantil 1', 'Infantil 2'] as SwimmingCategory[] },
  { label: 'Juvenil', categories: ['Juvenil 1', 'Juvenil 2'] as SwimmingCategory[] },
  { label: 'Júnior', categories: ['Júnior 1', 'Júnior 2'] as SwimmingCategory[] },
  { label: 'Sênior', categories: ['Sênior'] as SwimmingCategory[] },
  {
    label: 'Master',
    categories: [
      'Pré-Master',
      'Master A',
      'Master B',
      'Master C',
      'Master D',
      'Master E',
      'Master F',
      'Master G',
      'Master H',
      'Master I',
      'Master J',
      'Master K',
      'Master L',
      'Master M',
      'Master N',
      'Master O',
    ] as SwimmingCategory[],
  },
] as const

const CATEGORY_GROUP_ORDER = TEACHER_CATEGORY_OPTIONS.reduce<Record<string, number>>((acc, category, index) => {
  acc[category] = index
  return acc
}, {})

export function getCategoryByBirthYear(birthYear: number): SwimmingCategory {
  const age = REFERENCE_YEAR - birthYear
  return getCategoryByAge(age)
}

export function getCategoryByAge(age: number): SwimmingCategory {
  if (age < 6) return 'Pré-Mirim'
  if (age <= 8) return 'Pré-Mirim'
  if (age === 9) return 'Mirim 1'
  if (age === 10) return 'Mirim 2'
  if (age === 11) return 'Petiz 1'
  if (age === 12) return 'Petiz 2'
  if (age === 13) return 'Infantil 1'
  if (age === 14) return 'Infantil 2'
  if (age === 15) return 'Juvenil 1'
  if (age === 16) return 'Juvenil 2'
  if (age === 17) return 'Júnior 1'
  if (age <= 19) return 'Júnior 2'
  if (age <= 24) return 'Sênior'
  if (age <= 29) return 'Master A'
  if (age <= 34) return 'Master B'
  if (age <= 39) return 'Master C'
  if (age <= 44) return 'Master D'
  if (age <= 49) return 'Master E'
  if (age <= 54) return 'Master F'
  if (age <= 59) return 'Master G'
  if (age <= 64) return 'Master H'
  if (age <= 69) return 'Master I'
  if (age <= 74) return 'Master J'
  if (age <= 79) return 'Master K'
  if (age <= 84) return 'Master L'
  if (age <= 89) return 'Master M'
  if (age <= 94) return 'Master N'
  return 'Master O'
}

export function sortGroupedCategories(categories: string[]): string[] {
  return [...new Set(categories)].sort((left, right) => {
    const leftIndex = CATEGORY_GROUP_ORDER[left] ?? Number.MAX_SAFE_INTEGER
    const rightIndex = CATEGORY_GROUP_ORDER[right] ?? Number.MAX_SAFE_INTEGER
    return leftIndex - rightIndex || left.localeCompare(right, 'pt-BR')
  })
}

const joinCategoryLabels = (labels: string[]) => {
  if (labels.length <= 1) return labels[0] ?? ''
  if (labels.length === 2) return `${labels[0]} e ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`
}

export function formatMixedCategoryLabel(categories: string[]): string {
  const sorted = sortGroupedCategories(categories)

  if (sorted.length === 0) return 'Não informada'
  if (sorted.length === 1) return sorted[0]

  const indexes = sorted.map((category) => CATEGORY_GROUP_ORDER[category] ?? -1)
  const isContiguous = indexes.every((index, current) => current === 0 || index === indexes[current - 1] + 1)

  if (sorted.length === 2) {
    return `${sorted[0]} e ${sorted[1]}`
  }

  if (isContiguous) {
    return `${sorted[0]} ao ${sorted[sorted.length - 1]}`
  }

  return joinCategoryLabels(sorted)
}
