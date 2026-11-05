import { formatDayMonthYear } from "../../../../shared/lib/dates";
import { costDisplay, currency, quantityDisplay } from "../../utils/format";
import { packedQuantityLabel } from "../../utils/shopping";

// Sums of the histories, apart per unit (and isi): 2 kg + 500 gr.
const round = (value) => Math.round(value * 1000) / 1000;
const sumPerUnit = (histories, quantityOf, unitKeyOf) => {
  const sums = new Map();
  histories.forEach((history) => {
    const key = unitKeyOf(history);
    const sum = sums.get(key);
    if (sum) sum.quantity = round(sum.quantity + Number(quantityOf(history) || 0));
    else sums.set(key, { ...history, quantity: Number(quantityOf(history) || 0) });
  });
  return [...sums.values()];
};
// Each toko or merk once, latest first: "A, B +2".
const listOf = (values) => {
  const unique = [...new Set(values.filter(Boolean))];
  return unique.length > 2 ? `${unique.slice(0, 2).join(", ")} +${unique.length - 2}` : unique.join(", ");
};

// The "Per Item" history: one row per item and kemasan (splitByKemasan) with
// every purchase of the period summed (Gramasi/Qty, Masuk Stok, Jumlah), every
// toko and merk, and the date, nota and COGS of the latest one; clicking opens
// the detail of those purchases (each one, with the harga satuan). costLabel names the moving average (COGS, or
// Harga Rata-rata for Lainnya). Jumlah is the last column, so TOTAL
// PENGELUARAN closes the table right under it: what every purchase of the tab, period and search cost (with its
// share of ongkir/diskon/PPN), on all pages (itemCount items). hasStock false
// (barang Lainnya that are spent): no Masuk Stok or harga rata-rata; hasCost
// false (also a bahan baku that is not a Bahan Resep): no COGS on its row.
const PurchaseHistoryTable = ({
  itemGroups,
  itemCount = itemGroups.length,
  totalSpending,
  periodText = "",
  onOpen,
  showUnits = true,
  costLabel = "COGS",
  hasStock = () => true,
  hasCost = () => true,
}) => {
  // Barang Lainnya (showUnits false) are counted per piece.
  const qty = (value, unit) => quantityDisplay(value, showUnits ? unit : "");
  const cost = (value, unit) => (showUnits ? costDisplay(value, unit) : currency(value));

  return (
    <div className="overflow-x-auto rounded-lg border border-[#444]">
      <table className="w-full text-left text-sm">
        <thead className="bg-[#202020] text-[#ababab]">
          <tr>
            <th className="p-3">Barang</th>
            <th className="p-3">Terakhir Dibeli</th>
            <th className="p-3">Toko</th>
            <th className="p-3">Merk</th>
            <th className="p-3">{showUnits ? "Gramasi" : "Qty"}</th>
            <th className="p-3 text-right">Masuk Stok</th>
            <th className="p-3 text-right">{costLabel} Setelah</th>
            <th className="p-3 text-right">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {itemGroups.map((group) => {
            const item = group.histories[0];

            if (!item) return null;
            const { kemasan } = group;
            const quantity = group.histories.reduce((total, history) => round(total + Number(history.quantity || 0)), 0);
            const stocked = sumPerUnit(group.histories, (history) => history.stockQuantity, (history) => history.stockUnit)
              .map((sum) => qty(sum.quantity, sum.stockUnit))
              .join(" + ");
            // A kemasan in its own unit; kg and gr of the same barang in the stock unit.
            const bought = !showUnits
              ? qty(quantity)
              : kemasan
                ? packedQuantityLabel(quantity, kemasan.unit, kemasan.packSize, kemasan.packUnit)
                : new Set(group.histories.map((history) => history.unit)).size === 1
                  ? qty(quantity, item.unit)
                  : stocked;
            const spent = group.histories.reduce((total, history) => total + Number(history.total || 0), 0);
            const merks = listOf(group.histories.map((history) => history.merkName));

            return (
              <tr
                key={`${group.stockItemId || group.itemName}|${group.kemasanKey ?? ""}`}
                className="cursor-pointer border-t border-[#444] transition-colors hover:bg-[#262626]"
                onClick={() => onOpen(group)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen(group);
                  }
                }}
              >
                <td className="p-3">
                  <strong className="block font-bold">
                    {group.itemName}
                    {kemasan && (
                      <span className="ml-1 text-xs font-normal text-[#ababab]">
                        · {kemasan.unit} isi {qty(kemasan.packSize, kemasan.packUnit)}
                      </span>
                    )}
                  </strong>
                  <span className="mt-1 inline-flex rounded-md bg-[#262626] px-2 py-1 text-xs font-semibold text-[#ababab]">
                    {group.purchaseCount} history
                  </span>
                </td>
                <td className="whitespace-nowrap p-3">
                  {formatDayMonthYear(item.purchaseDate)}
                  <p className="text-xs text-[#ababab]">
                    #{item.purchaseId} - {item.paymentMethod}
                    {item.attachments?.length > 0 && ` · ${item.attachments.length} bukti`}
                  </p>
                </td>
                <td className="p-3">{listOf(group.histories.map((history) => history.supplierName))}</td>
                <td className="p-3">{merks || <span className="text-[#ababab]">-</span>}</td>
                <td className="p-3">{bought}</td>
                <td className="p-3 text-right">
                  {hasStock(group) ? stocked : <span className="text-[#ababab]">-</span>}
                </td>
                <td className="p-3 text-right">
                  {hasCost(group) ? (
                    <>
                      {cost(item.stockAverageCost, item.stockUnit)}
                      <p className="text-xs text-[#ababab]">Nilai: {currency(item.stockValueAfter)}</p>
                    </>
                  ) : (
                    <span className="text-[#ababab]">-</span>
                  )}
                </td>
                <td className="p-3 text-right">{currency(Math.round(spent * 100) / 100)}</td>
              </tr>
            );
          })}
        </tbody>
        {totalSpending != null && (
          <tfoot className="border-t-2 border-[#a79981]/60 bg-[#202020]">
            <tr>
              <td colSpan={7} className="p-3">
                <strong className="text-base tracking-wide">TOTAL PENGELUARAN</strong>
                <span className="ml-2 text-xs text-[#ababab]">
                  {itemCount} item{periodText && ` · ${periodText}`}
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

export default PurchaseHistoryTable;
