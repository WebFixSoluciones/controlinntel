export const DOCUMENT_PAGE_SIZES = [10, 20, 30] as const;
export type DocumentPageSize = (typeof DOCUMENT_PAGE_SIZES)[number];

export type DocumentPageSelection = {
  filterKey: string;
  page: number;
  pageSize: DocumentPageSize;
};

export function documentPage(total: number, selection: DocumentPageSelection, filterKey: string) {
  const { pageSize } = selection;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = selection.filterKey === filterKey ? Math.max(1, Math.min(selection.page, pageCount)) : 1;
  const start = (page - 1) * pageSize;

  return { page, pageCount, start, end: Math.min(start + pageSize, total) };
}
