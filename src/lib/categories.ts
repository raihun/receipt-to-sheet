/**
 * 家計簿シートの C列（費目）と D列（小項目）の選択肢。
 * シート側のデータの入力規則（ドロップダウン）と一致させること。
 */

export const CATEGORIES = ['食費', '日用品', '特別費'] as const

export type Category = (typeof CATEGORIES)[number]

/** 小項目を持つのは今のところ食費だけ。他の費目は空欄で入れる */
const SUB_CATEGORIES: Partial<Record<Category, readonly string[]>> = {
  食費: ['内食', '中食', '外食'],
}

export function subCategoriesOf(category: Category): readonly string[] {
  return SUB_CATEGORIES[category] ?? []
}

export const DEFAULT_CATEGORY: Category = '食費'

export function defaultSubCategory(category: Category): string {
  return subCategoriesOf(category)[0] ?? ''
}
