"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DOCUMENT_PAGE_SIZES, documentPage, type DocumentPageSelection, type DocumentPageSize } from "@/lib/document-pagination";

export function useDocumentPagination<T>(items: readonly T[], filters: readonly (string | boolean | undefined)[] = []) {
  const filterKey = JSON.stringify(filters);
  const [selection, setSelection] = useState<DocumentPageSelection>({ filterKey, page: 1, pageSize: DOCUMENT_PAGE_SIZES[0] });
  const total = items.length;
  const { page, pageCount, start, end } = documentPage(total, selection, filterKey);

  if (selection.filterKey !== filterKey || selection.page !== page) {
    setSelection({ ...selection, filterKey, page });
  }

  function movePage(by: -1 | 1) {
    setSelection(current => ({ ...current, page: Math.max(1, Math.min(pageCount, current.page + by)) }));
  }

  function changePageSize(pageSize: DocumentPageSize) {
    setSelection({ filterKey, page: 1, pageSize });
  }

  return {
    rows: items.slice(start, end),
    // Printable tables keep all filtered rows in the document for the print view.
    printableRowClass: (index: number) => index < start || index >= end ? "hidden print:table-row" : "",
    controls: { total, page, pageCount, start, end, pageSize: selection.pageSize, movePage, changePageSize },
  };
}

type PaginationControls = ReturnType<typeof useDocumentPagination>["controls"];

export function DocumentTablePagination({ total, page, pageCount, start, end, pageSize, movePage, changePageSize }: PaginationControls) {
  if (total === 0) return null;

  const buttonClass = "inline-flex min-h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45 disabled:cursor-not-allowed";

  return (
    <nav aria-label="Paginación de documentos" className="sticky left-0 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 print:hidden">
      <p aria-live="polite" className="tabular-nums">Mostrando {start + 1}–{end} de {total}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-2">
          Filas por página
          <select
            value={pageSize}
            onChange={event => {
              const size = DOCUMENT_PAGE_SIZES.find(option => option === Number(event.currentTarget.value));
              if (size) changePageSize(size);
            }}
            className="min-h-8 rounded-md border border-slate-300 bg-white px-2 text-slate-700"
          >
            {DOCUMENT_PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={page === 1} onClick={() => movePage(-1)} className={buttonClass}>
            <ChevronLeft aria-hidden="true" className="size-3.5" /> Anterior
          </button>
          <span className="whitespace-nowrap tabular-nums">Página {page} de {pageCount}</span>
          <button type="button" disabled={page === pageCount} onClick={() => movePage(1)} className={buttonClass}>
            Siguiente <ChevronRight aria-hidden="true" className="size-3.5" />
          </button>
        </div>
      </div>
    </nav>
  );
}
