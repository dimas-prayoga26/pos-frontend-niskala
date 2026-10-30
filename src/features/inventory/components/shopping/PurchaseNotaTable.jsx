import { formatDayMonthYear } from "../../../../shared/lib/dates";
import { currency, quantityDisplay, signedCurrency } from "../../utils/format";
import { notaFooterLines, packedQuantityLabel } from "../../utils/shopping";

// The "Per Nota" history, laid out like the nota itself: the toko as a heading
// (tanggal, nomor, pembuat, catatan, bukti), each barang on its own row
// (sumber pembayaran, qty, harga, jumlah), then ongkir, diskon and PPN, and the
// Grand Total under Jumlah. TOTAL PENGELUARAN closes the table: the Grand
// Total of every nota of the tab, period (periodText) and search, on all pages
// (notaCount of them). The tab names the kategori, so lines carry no badge.
// Clicking a nota opens its Detail Struk (what was bought on it, line by line).
const PurchaseNotaTable = ({
  notas,
  notaCount = notas.length,
  totalSpending,
  periodText = "",
  onOpenNota,
  onOpenReceipts,
  isAdmin,
  showUnits = true,
}) => {
  // Barang Lainnya (showUnits false) are counted per piece.
  const qty = (value, unit) => quantityDisplay(value, showUnits ? unit : "");

  return (
    <div className="overflow-x-auto rounded-lg border border-[#444]">
      <table className="w-full text-left text-sm">
        <thead className="bg-[#202020] text-[#ababab]">
          <tr>
            <th className="p-3">Barang</th>
            <th className="p-3 text-center">Sumber Pembayaran</th>
            <th className="p-3 text-right">{showUnits ? "Gramasi" : "Qty"}</th>
            <th className="p-3 text-right">{showUnits ? "Harga Satuan" : "Harga"}</th>
            <th className="p-3 text-right">Jumlah</th>
          </tr>
        </thead>
        {notas.map((nota) => {
          const extras = notaFooterLines(nota);
          const rowCount = Math.max(nota.items.length, 1) + extras.length;
          // One merged cell for the whole nota, centered in both directions and
          // framed like a spreadsheet merge. Its own background (the card's)
          // keeps the hover of the first barang row, which owns the cell, from
          // lighting up the whole span.
          const sourceCell = (
            <td
              rowSpan={rowCount}
              className="border-x border-[#333] bg-[#1f1f1f] p-3 text-center align-middle font-semibold transition-colors group-hover:bg-[#262626]"
            >
              {nota.paymentMethod}
            </td>
          );

          return (
            // A click anywhere on the nota opens its Detail Struk; the toko and
            // barang names are its buttons for the keyboard (the click reaches
            // the nota). The whole nota lights up on hover.
            <tbody
              key={nota.id}
              aria-label={`Nota #${nota.id} ${nota.supplierName}`}
              className="group cursor-pointer border-t-2 border-[#444]"
              onClick={() => onOpenNota(nota)}
            >
              <tr className="bg-[#1b1b1b]">
                <td colSpan={5} className="p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <button type="button" className="text-left text-base font-bold hover:underline">
                        {nota.supplierName}
                      </button>
                      <span className="ml-2 text-xs text-[#ababab]">
                        {formatDayMonthYear(nota.date)} · Nota #{nota.id}
                        {nota.createdBy && ` · Dibuat ${nota.createdBy}`}
                        {nota.postedBy && ` · Diposting ${nota.postedBy}`}
                      </span>
                      {nota.note && <p className="mt-1 text-xs text-[#ababab]">Catatan: {nota.note}</p>}
                    </div>
                    {(isAdmin || nota.attachments.length > 0) && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenReceipts(nota.id);
                        }}
                        className="rounded-md border border-[#a79981]/40 px-3 py-1 text-xs font-semibold text-[#d6c7ae] hover:bg-[#a79981]/10"
                      >
                        {nota.attachments.length ? `Bukti (${nota.attachments.length})` : "+ Bukti"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
              {nota.items.map((item, index) => (
                <tr key={item.id} className="border-t border-[#333] transition-colors group-hover:bg-[#262626]">
                  <td className="p-3 pl-6">
                    <button type="button" className="text-left hover:underline">
                      {item.itemName}
                    </button>
                  </td>
                  {index === 0 && sourceCell}
                  <td className="whitespace-nowrap p-3 text-right">
                    {showUnits ? packedQuantityLabel(item.quantity, item.unit, item.packSize, item.packUnit) : qty(item.quantity, item.unit)}
                  </td>
                  <td className="whitespace-nowrap p-3 text-right">{currency(item.unitPrice)}</td>
                  <td className="whitespace-nowrap p-3 text-right">{currency(item.total)}</td>
                </tr>
              ))}
              {!nota.items.length && (
                <tr className="border-t border-[#333] transition-colors group-hover:bg-[#262626]">
                  <td className="p-3 pl-6 text-[#ababab]">Semua barang nota ini sudah dihapus.</td>
                  {sourceCell}
                  <td colSpan={3} />
                </tr>
              )}
              {extras.map((line) => (
                <tr key={line.key} className="border-t border-[#333] text-[#ababab] transition-colors group-hover:bg-[#262626]">
                  <td className="p-3 pl-6">{line.label}</td>
                  <td className="whitespace-nowrap p-3 text-right">{line.quantity ?? ""}</td>
                  <td className="whitespace-nowrap p-3 text-right">{line.price == null ? "" : currency(line.price)}</td>
                  <td className={`whitespace-nowrap p-3 text-right ${line.amount < 0 ? "text-green-400" : ""}`.trim()}>
                    {signedCurrency(line.amount)}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-[#444] transition-colors group-hover:bg-[#262626]">
                <td colSpan={4} className="p-3 text-right text-[#ababab]">
                  Total
                </td>
                <td className="whitespace-nowrap p-3 text-right text-base font-bold">{currency(nota.total)}</td>
              </tr>
            </tbody>
          );
        })}
        {totalSpending != null && (
          <tfoot className="border-t-2 border-[#a79981]/60 bg-[#202020]">
            <tr>
              <td colSpan={4} className="p-3">
                <strong className="text-base tracking-wide">TOTAL PENGELUARAN</strong>
                <span className="ml-2 text-xs text-[#ababab]">
                  {notaCount} nota{periodText && ` · ${periodText}`}
                </span>
              </td>
              <td className="whitespace-nowrap p-3 text-right text-lg font-bold text-[#f6d365]" data-testid="total-spending">
                {currency(totalSpending)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};

export default PurchaseNotaTable;
