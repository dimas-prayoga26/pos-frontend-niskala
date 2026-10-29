import { costDisplay, currency, quantityDisplay } from "../../utils/format";

// One row per item showing its most recent purchase; clicking opens the detail.
// costLabel names the moving average (COGS, or Harga Rata-rata for Lainnya).
const PurchaseHistoryTable = ({ itemGroups, onOpen, showUnits = true, costLabel = "COGS" }) => {
  // Barang Lainnya (showUnits false) are counted per piece.
  const qty = (value, unit) => quantityDisplay(value, showUnits ? unit : "");
  const cost = (value, unit) => (showUnits ? costDisplay(value, unit) : currency(value));

  return (
    <div className="overflow-x-auto rounded-lg border border-[#444]">
      <table className="w-full text-left text-sm">
        <thead className="bg-[#202020] text-[#ababab]">
          <tr>
            <th className="p-3">Barang</th>
            <th className="p-3">Tanggal</th>
            <th className="p-3">Toko</th>
            <th className="p-3">{showUnits ? "Gramasi" : "Qty"}</th>
            <th className="p-3 text-right">{showUnits ? "Harga Satuan" : "Harga per Barang"}</th>
            <th className="p-3 text-right">Jumlah</th>
            <th className="p-3 text-right">Masuk Stok</th>
            <th className="p-3 text-right">{costLabel} Setelah</th>
          </tr>
        </thead>
        <tbody>
          {itemGroups.map((group) => {
            const item = group.histories[0];

            if (!item) return null;

            return (
              <tr
                key={group.stockItemId || group.itemName}
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
                  <strong className="block font-bold">{group.itemName}</strong>
                  <span className="mt-1 inline-flex rounded-md bg-[#262626] px-2 py-1 text-xs font-semibold text-[#ababab]">
                    {group.purchaseCount} history
                  </span>
                </td>
                <td className="whitespace-nowrap p-3">
                  {String(item.purchaseDate).slice(0, 10)}
                  <p className="text-xs text-[#ababab]">
                    #{item.purchaseId} - {item.paymentMethod}
                    {item.attachments?.length > 0 && ` · ${item.attachments.length} bukti`}
                  </p>
                </td>
                <td className="p-3">{item.supplierName}</td>
                <td className="p-3">{qty(item.quantity, item.unit)}</td>
                <td className="p-3 text-right">{currency(item.unitPrice)}</td>
                <td className="p-3 text-right">{currency(item.total)}</td>
                <td className="p-3 text-right">
                  {qty(item.stockQuantity, item.stockUnit)}
                </td>
                <td className="p-3 text-right">
                  {cost(item.stockAverageCost, item.stockUnit)}
                  <p className="text-xs text-[#ababab]">Nilai: {currency(item.stockValueAfter)}</p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PurchaseHistoryTable;
