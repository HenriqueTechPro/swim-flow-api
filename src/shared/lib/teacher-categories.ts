import { CATEGORY_GROUPS } from './categories'

const categoryGroupMap = new Map<string, readonly string[]>(
  CATEGORY_GROUPS.map((group) => [group.label, group.categories]),
)

const categoryNameToGroup = new Map<string, string>()

for (const group of CATEGORY_GROUPS) {
  for (const category of group.categories) {
    categoryNameToGroup.set(category, group.label)
  }
}

export function expandTeacherCategorySelection(selectedLabels: string[]): string[] {
  const expanded = new Set<string>()

  for (const label of selectedLabels) {
    const grouped = categoryGroupMap.get(label)
    if (grouped) {
      grouped.forEach((category) => expanded.add(category))
      continue
    }

    expanded.add(label)
  }

  return Array.from(expanded)
}

export function compressTeacherCategoryNames(categoryNames: string[]): string[] {
  const grouped = new Set<string>()

  for (const categoryName of categoryNames) {
    const label = categoryNameToGroup.get(categoryName)
    if (label) {
      grouped.add(label)
      continue
    }

    grouped.add(categoryName)
  }

  return Array.from(grouped)
}
