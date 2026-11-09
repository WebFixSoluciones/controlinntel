export type ReportColumn = { key: string; label: string; money?: boolean };
export async function downloadReport(rows: Record<string, unknown>[], columns: ReportColumn[], title: string, format: "csv" | "xlsx", criteria: string) {
  const values = rows.map(row => columns.map(column => row[column.key] ?? ""));
  let blob: Blob;
  if (format === "xlsx") {
    const ExcelJS = await import("exceljs");
    const book = new ExcelJS.Workbook(), sheet = book.addWorksheet("Reporte");
    sheet.addRow(columns.map(column => column.label)); values.forEach(row => sheet.addRow(row));
    columns.forEach((column, index) => { sheet.getColumn(index + 1).width = column.money ? 19 : 34; if (column.money) sheet.getColumn(index + 1).numFmt = '"$"#,##0.00'; });
    sheet.getRow(1).font = { bold: true }; sheet.views = [{ state: "frozen", ySplit: 1 }];
    const filters = book.addWorksheet("Criterios"); filters.addRows([["Reporte", title], ["Filtros", criteria]]); filters.getColumn(2).width = 90;
    blob = new Blob([await book.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  } else {
    const escape = (value: unknown) => { const text = String(value); return '"' + (typeof value === "string" && /^\s*[=+@-]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"'; };
    const all = [[title, criteria], columns.map(column => column.label), ...values];
    blob = new Blob(["\uFEFF" + all.map(row => row.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  }
  const url = URL.createObjectURL(blob), anchor = document.createElement("a"); anchor.href = url; anchor.download = title.replace(/[^a-zA-Z0-9_-]/g, "_") + "." + format; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
