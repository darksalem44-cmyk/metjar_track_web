/**
 * صف خام من Supabase. أنواع قاعدة البيانات المولَّدة غير متاحة لأن المخطط ليس في
 * المستودع (A12)، وهذا الحدّ الوحيد الذي يُعفى فيه الفحص من أي.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export interface PageParams {
  page: number;
  pageSize: number;
}

export interface PageResult<T> {
  items: T[];
  hasMore: boolean;
}

/** يقسّم النتائج الزائدة إلى صفحة ويحدد هل توجد صفحات أخرى. */
export function resolvePage<T>(items: T[], page: number, pageSize: number): PageResult<T> {
  const hasMore = items.length > pageSize;
  return { items: items.slice(0, pageSize), hasMore };
}

export const PAGE_SIZE = 20;