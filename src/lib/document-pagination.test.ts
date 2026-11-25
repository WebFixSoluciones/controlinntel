import test from "node:test";
import assert from "node:assert/strict";
import { documentPage, type DocumentPageSelection } from "./document-pagination.ts";

const selected: DocumentPageSelection = { filterKey: "todos", page: 2, pageSize: 10 };

test("la página toma solo su tramo del listado ya filtrado y ordenado", () => {
  const rows = Array.from({ length: 27 }, (_, index) => 27 - index);
  const page = documentPage(rows.length, selected, "todos");
  assert.deepEqual(page, { page: 2, pageCount: 3, start: 10, end: 20 });
  assert.deepEqual(rows.slice(page.start, page.end), [17, 16, 15, 14, 13, 12, 11, 10, 9, 8]);
  assert.equal(rows.length, 27);
});

test("un cambio de filtro vuelve a la primera página sin perder el tamaño elegido", () => {
  assert.deepEqual(documentPage(41, { ...selected, pageSize: 20 }, "pagadas"), {
    page: 1, pageCount: 3, start: 0, end: 20,
  });
});

test("ajusta la página tras eliminar filas y maneja un resultado vacío", () => {
  assert.deepEqual(documentPage(31, { ...selected, page: 3, pageSize: 30 }, "todos"), {
    page: 2, pageCount: 2, start: 30, end: 31,
  });
  assert.deepEqual(documentPage(0, selected, "todos"), { page: 1, pageCount: 1, start: 0, end: 0 });
});
