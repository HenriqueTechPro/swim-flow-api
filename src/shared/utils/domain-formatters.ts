const CATEGORY_LABELS: Record<string, string> = {
  Pre_Mirim: 'Pre-Mirim',
  Mirim_1: 'Mirim 1',
  Mirim_2: 'Mirim 2',
  Petiz_1: 'Petiz 1',
  Petiz_2: 'Petiz 2',
  Infantil_1: 'Infantil 1',
  Infantil_2: 'Infantil 2',
  Juvenil_1: 'Juvenil 1',
  Juvenil_2: 'Juvenil 2',
  Junior_1: 'Junior 1',
  Junior_2: 'Junior 2',
  Senior: 'Senior',
  Pre_Master: 'Pre-Master',
  Master_A: 'Master A',
  Master_B: 'Master B',
  Master_C: 'Master C',
  Master_D: 'Master D',
  Master_E: 'Master E',
  Master_F: 'Master F',
  Master_G: 'Master G',
  Master_H: 'Master H',
  Master_I: 'Master I',
  Master_J: 'Master J',
  Master_K: 'Master K',
  Master_L: 'Master L',
  Master_M: 'Master M',
  Master_N: 'Master N',
  Master_O: 'Master O',
}

const CATEGORY_KEYS = Object.fromEntries(
  Object.entries(CATEGORY_LABELS).map(([key, value]) => [value, key]),
) as Record<string, string>

export const formatCategoryLabel = (value: string) => CATEGORY_LABELS[value] ?? value

export const parseCategoryValue = (value: string) => CATEGORY_KEYS[value] ?? value

export const normalizeHumanLabel = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

export const formatEntityStatus = (value: string) => {
  if (value === 'Licenca') return 'Licença'
  if (value === 'Inativo') return 'Inativo'
  return 'Ativo'
}
