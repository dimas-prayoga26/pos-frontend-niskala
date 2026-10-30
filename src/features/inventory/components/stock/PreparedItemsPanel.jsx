import { formatDateAndTime } from "../../../../shared/lib/dates";
import { costDisplay, currency, quantityDisplay } from "../../utils/format";
import { describeComposition } from "../../utils/preparedItems";
import { STOCK_STATUS_CLASS_NAMES } from "../../utils/stockItems";

const actionClass = "font-semibold text-[#d6c7ae] hover:text-[#f5f5f5]";

// "Bahan Setengah Jadi" tab: items cooked in-house (Nasi, Sambal, ...). Portions come
// from "Catat Masak"; selling a menu uses them like any stock item.
const PreparedItemsPanel = ({
  preparedItems,
  isAdmin,
  onAdd,
  onEdit,
  onProduce,
  onHistory,
  onAdjust,
  onWaste,
  onWasteHistory,
  onDelete,
}) => (
  <div className="rounded-lg bg-[#1f1f1f] p-4">
    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-lg font-bold text-[#f5f5f5]">Bahan Setengah Jadi</h3>
        <p className="mt-1 text-sm text-[#ababab]">
          Bahan yang dimasak sendiri dari bahan mentah. Jumlah porsi didapat dari berat hasil
          masak dibagi takaran 1 porsi.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <button
          type="button"
          onClick={onWasteHistory}
          className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5]"
        >
          Riwayat Kerugian
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={onAdd}
            className="rounded-lg bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010]"
          >
            Tambah Bahan Setengah Jadi
          </button>
        )}
      </div>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full text-left text-[#f5f5f5]">
        <thead className="bg-[#333] text-[#ababab]">
          <tr>
            <th className="p-3">Bahan Setengah Jadi</th>
            <th className="p-3 text-center">Takaran 1 Porsi</th>
            <th className="p-3 text-center">Hasil Terakhir</th>
            <th className="p-3 text-center">Stok</th>
            <th className="p-3 text-right">Nilai Asset</th>
            <th className="p-3 text-right" title="Nilai Asset ÷ Stok: rata-rata semua porsi yang masih ada">
              COGS Sekarang
            </th>
            <th className="p-3 text-center">Status</th>
            <th className="p-3 text-center">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {preparedItems.map((item) => {
            const lastProduction = item.lastProduction;
            // COGS Sekarang averages every portion in stock; it differs from the
            // last cooking's cost while portions of an earlier one are left.
            const mixesEarlierCooking =
              lastProduction && Number(item.stock) > 0 && Number(item.averageCost) !== Number(lastProduction.unitCost);

            return (
              <tr key={item.id || item._id} className="border-b border-gray-600 hover:bg-[#333]">
                <td className="p-4">
                  <p className="font-semibold">
                    {item.name}
                    {item.resetDaily && (
                      <span
                        title="Sisa porsi dibuang saat hari ditutup (otomatis pukul 05.00 keesokan harinya, atau saat Rekap Harian disimpan)"
                        className="ml-2 rounded-md bg-[#333] px-2 py-0.5 text-xs font-semibold text-[#d6c7ae]"
                      >
                        Harian
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs font-medium text-[#ababab]">
                    1 resep: {describeComposition(item.components) || "-"} ·{" "}
                    {currency(item.recipeCost)}
                  </p>
                </td>
                <td className="p-4 text-center">
                  {item.portionSize > 0 ? `${quantityDisplay(item.portionSize, "gr")}` : "-"}
                </td>
                <td className="p-4 text-center">
                  {lastProduction ? (
                    <>
                      <span className="block font-semibold">
                        {quantityDisplay(item.yieldQuantity, item.unit)} / resep
                      </span>
                      <span className="block text-xs text-[#d6c7ae]">
                        Biaya {costDisplay(lastProduction.unitCost, item.unit)}
                      </span>
                      <span className="mt-1 block text-xs text-[#ababab]">
                        {formatDateAndTime(lastProduction.producedAt)}
                      </span>
                    </>
                  ) : (
                    <span className="text-[#ababab]">Belum dimasak</span>
                  )}
                </td>
                <td className="p-4 text-center font-semibold">
                  {quantityDisplay(item.stock, item.unit)}
                </td>
                <td className="p-4 text-right">
                  <span className="whitespace-nowrap font-semibold">{currency(item.stockValue)}</span>
                </td>
                <td className="p-4 text-right">
                  <span className="whitespace-nowrap font-semibold text-[#f6d365]">
                    {costDisplay(item.averageCost, item.unit)}
                  </span>
                  {mixesEarlierCooking && (
                    <span className="mt-1 block text-xs text-[#ababab]">
                      Rata-rata stok, ada sisa masak sebelumnya
                    </span>
                  )}
                </td>
                <td className="p-4 text-center">
                  <span
                    className={`inline-flex min-w-[110px] items-center justify-center rounded-lg px-2 py-1 text-sm font-semibold ${
                      STOCK_STATUS_CLASS_NAMES[item.status] || "bg-[#2e4a40] text-green-400"
                    }`}
                  >
                    {item.status}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
                    <button
                      type="button"
                      onClick={() => onProduce(item)}
                      className="rounded-md bg-[#a79981] px-3 py-1 font-bold text-[#101010]"
                    >
                      Catat Masak
                    </button>
                    <button type="button" onClick={() => onHistory(item)} className={actionClass}>
                      Riwayat
                    </button>
                    <button type="button" onClick={() => onAdjust(item)} className={actionClass}>
                      Sesuaikan
                    </button>
                    <button
                      type="button"
                      onClick={() => onWaste(item)}
                      disabled={!(Number(item.stock) > 0)}
                      className="font-semibold text-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Buang
                    </button>
                    {isAdmin && (
                      <>
                        <button type="button" onClick={() => onEdit(item)} className={actionClass}>
                          Ubah
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(item)}
                          className="font-semibold text-red-400 hover:text-red-300"
                        >
                          Hapus
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {preparedItems.length === 0 && (
            <tr>
              <td className="p-4 text-center text-[#ababab]" colSpan={8}>
                Belum ada bahan setengah jadi. Tambahkan Nasi, Sambal, atau bahan lain yang dimasak
                sendiri.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

export default PreparedItemsPanel;
