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