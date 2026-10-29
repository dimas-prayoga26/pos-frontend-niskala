import * as XLSX from "xlsx-js-style";
import { currency, quantityDisplay, signedCurrency } from "./format";
import { notaFooterLines } from "./shopping";

const EXPORT_PAGE_SIZE = 500;

// Every posted nota of the tab, period and search (all pages) for an export.
export const fetchAllNotas = async (kind, params) => {
  const notas = [];
  let total = 0;
  let totalSpending = 0;
  for (let page = 1; page === 1 || notas.length < total; page += 1) {
    const data = (await kind.listNotas({ ...params, page, pageSize: EXPORT_PAGE_SIZE }))?.data?.data || {};
    notas.push(...(data.notas || []));
    total = Number(data.total || 0);
    totalSpending = Number(data.totalSpending || 0);
    if (!data.notas?.length) break;
  }
  return { notas, total, totalSpending };
};

// The rekap rows, like the REKAP PENGELUARAN sheet: each nota's barang (the
// tanggal, nota and toko on its first line), its ongkir / diskon / PPN, its
// Total, and TOTAL PENGELUARAN at the end. kind: "item" | "extra" | "total" |
// "grand" for the styling.
export const buildRekapRows = (notas, totalSpending, { showUnits = true } = {}) => {
  const rows = [];
  notas.forEach((nota) => {
    const head = [String(nota.date).slice(0, 10), `#${nota.id}`, nota.supplierName];
    nota.items.forEach((item, index) => {
      rows.push({
        kind: "item",
        cells: [
          ...(index === 0 ? head : ["", "", ""]),
          item.itemName,
          index === 0 ? nota.paymentMethod : "",
          item.quantity,
          ...(showUnits ? [item.unit || ""] : []),
          item.unitPrice,
          item.total,
        ],
      });
    });
    if (!nota.items.length) rows.push({ kind: "item", cells: [...head, "(semua barang dihapus)", nota.paymentMethod, "", ...(showUnits ? [""] : []), "", 0] });
    notaFooterLines(nota).forEach((line) => {
      rows.push({
        kind: "extra",
        cells: ["", "", "", line.label, "", line.quantity ?? "", ...(showUnits ? [""] : []), line.price ?? "", line.amount],
      });
    });
    rows.push({ kind: "total", cells: ["", "", "", "Total", "", "", ...(showUnits ? [""] : []), "", nota.total] });
  });
  rows.push({ kind: "grand", cells: ["TOTAL PENGELUARAN", "", "", `${notas.length} nota`, "", "", ...(showUnits ? [""] : []), "", totalSpending] });
  return rows;
};

export const rekapHeader = ({ showUnits = true } = {}) => [
  "Tanggal",
  "Nota",
  "Toko",
  "Barang",
  "Sumber Pembayaran",
  showUnits ? "Gramasi" : "Qty",
  ...(showUnits ? ["Satuan"] : []),
  showUnits ? "Harga Satuan" : "Harga",
  "Jumlah",
];

const fileSafe = (text) => String(text).replace(/[^\w-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

// Belanja-Peralatan-2026-10-01_2026-10-31.xlsx / .pdf
export const exportFileName = ({ tabLabel, range }, extension) =>
  `Belanja-${fileSafe(tabLabel)}-${range.from || "awal"}_${range.to || "sekarang"}.${extension}`;

const MONEY = '"Rp" #,##0';
const bold = { font: { bold: true } };

// Excel: title, period, header, then the rekap rows with rupiah formats.
export const exportRekapToExcel = ({ notas, totalSpending, tabLabel, range, periodText, showUnits }) => {
  const header = rekapHeader({ showUnits });
  const rows = buildRekapRows(notas, totalSpending, { showUnits });
  const worksheet = XLSX.utils.aoa_to_sheet([
    [`REKAP PENGELUARAN - ${tabLabel}`],
    [`Periode: ${periodText}`],
    [],
    header,
    ...rows.map((row) => row.cells),
  ]);
  const firstRow = 4;
  const moneyColumns = [header.length - 2, header.length - 1];
  worksheet.A1.s = { font: { bold: true, sz: 14 } };
  header.forEach((_, column) => {
    worksheet[XLSX.utils.encode_cell({ r: 3, c: column })].s = { ...bold, fill: { fgColor: { rgb: "E7E0D2" } } };
  });
  rows.forEach((row, index) => {
    moneyColumns.forEach((column) => {
      const cell = worksheet[XLSX.utils.encode_cell({ r: firstRow + index, c: column })];
      if (cell && typeof cell.v === "number") cell.z = MONEY;
    });
    if (row.kind === "total" || row.kind === "grand") {
      row.cells.forEach((_, column) => {
        const cell = worksheet[XLSX.utils.encode_cell({ r: firstRow + index, c: column })];
        if (cell) cell.s = row.kind === "grand" ? { ...bold, fill: { fgColor: { rgb: "F6D365" } } } : bold;
      });
    }
  });
  worksheet["!cols"] = header.map((title) => ({ wch: title === "Barang" ? 48 : title === "Toko" ? 22 : 16 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, fileSafe(tabLabel).slice(0, 31) || "Belanja");
  XLSX.writeFile(workbook, exportFileName({ tabLabel, range }, "xlsx"));
};

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

// The printable page for PDF (the browser's "Simpan sebagai PDF").
export const rekapHtml = ({ notas, totalSpending, tabLabel, periodText, showUnits }) => {
  const header = rekapHeader({ showUnits });
  const moneyStart = header.length - 2;
  const qtyColumn = 5;
  const cell = (value, column, kind) => {
    if (column >= moneyStart && typeof value === "number") return kind === "extra" ? signedCurrency(value) : currency(value);
    if (column === qtyColumn && typeof value === "number") return quantityDisplay(value, "");
    return escapeHtml(value);
  };
  const body = buildRekapRows(notas, totalSpending, { showUnits })
    .map(
      (row) =>
        `<tr class="${row.kind}">${row.cells
          .map((value, column) => `<td class="${column >= qtyColumn ? "num" : ""}">${cell(value, column, row.kind)}</td>`)
          .join("")}</tr>`
    )
    .join("");
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>REKAP PENGELUARAN - ${escapeHtml(tabLabel)}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px}
h1{font-size:18px;margin:0}p{margin:4px 0 16px;color:#555;font-size:12px}
table{border-collapse:collapse;width:100%;font-size:11px}
th,td{border-bottom:1px solid #ddd;padding:4px 6px;text-align:left;vertical-align:top}
th{background:#e7e0d2}td.num,th.num{text-align:right;white-space:nowrap}
tr.extra td{color:#555}tr.total td{font-weight:bold;border-bottom:2px solid #999}
tr.grand td{font-weight:bold;background:#f6d365;font-size:13px}
@page{size:A4 landscape;margin:12mm}
</style></head><body>
<h1>REKAP PENGELUARAN - ${escapeHtml(tabLabel)}</h1><p>Periode: ${escapeHtml(periodText)}</p>
<table><thead><tr>${header.map((title, column) => `<th class="${column >= qtyColumn ? "num" : ""}">${escapeHtml(title)}</th>`).join("")}</tr></thead>
<tbody>${body}</tbody></table></body></html>`;
};

// The print window is opened at the click, before the nota load, so the
// browser does not block it as a pop-up; null when it was blocked anyway.
export const openPrintWindow = () => {
  const printWindow = window.open("", "_blank");
  printWindow?.document.write("<p style=\"font-family:Arial\">Menyiapkan PDF...</p>");
  return printWindow;
};

// Fills the print window with the rekap and opens the browser's print
// (Simpan sebagai PDF).
export const printRekap = (printWindow, rekap) => {
  printWindow.document.open();
  printWindow.document.write(rekapHtml(rekap));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};
