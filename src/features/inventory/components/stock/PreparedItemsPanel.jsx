import { formatDateAndTime } from "../../../../shared/lib/dates";
import { costDisplay, currency, quantityDisplay } from "../../utils/format";
import { describeBahan } from "../../utils/preparedItems";
import { STOCK_STATUS_CLASS_NAMES } from "../../utils/stockItems";

const linkClass = "font-semibold text-[#d6c7ae] hover:text-[#f5f5f5]";

// "Bahan Setengah Jadi" tab: items cooked in-house (Nasi, Sambal, ...). Portions come
// from "Catat Masak"; selling a menu uses them like any stock item. Each row keeps
// the daily actions (Catat Masak, Buang) apart from the rarer ones. The Riwayat
// Kerugian button opens the thrown-away portions (PreparedWastesPanel).
const PreparedItemsPanel = ({
  preparedItems,
  isAdmin,
  onAdd,
  onEdit,
  onProduce,
  onHistory,
  onWaste,
  onDelete,
  onShowWastes,
}) => (
  <div className="rounded-lg bg-[#1f1f1f] p-4">
    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-lg font-bold text-[#f5f5f5]">Bahan Setengah Jadi</h3>
        <p className="mt-1 text-sm text-[#ababab]">Bahan yang dimasak sendiri dari bahan baku lalu dipakai di menu.</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onShowWastes}
          title="Porsi yang dibuang dan nilai kerugiannya"
          className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5] hover:bg-[#3a3a3a]"
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
        <thead className="bg-[#333] text-sm text-[#ababab]">
          <tr>
            <th className="p-3">Bahan Setengah Jadi</th>
            <th className="p-3 text-center">Stok</th>
            <th className="p-3 text-center">Masak Terakhir</th>
            <th className="p-3 text-right">Nilai Asset</th>
            <th className="p-3 text-right" title="Nilai Asset ÷ Stok: rata-rata semua porsi yang masih ada">
              COGS Sekarang
            </th>
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
            const hasStock = Number(item.stock) > 0;

            return (
              <tr key={item.id || item._id} className="border-b border-gray-600 align-top hover:bg-[#2a2a2a]">
                <td className="p-4">
                  <p className="font-semibold">
                    {item.name}
                    <span
                      title={
                        item.resetDaily
                          ? "Sisa porsi dibuang saat hari ditutup (otomatis pukul 00.00, atau saat Rekap Harian disimpan)"
                          : "Sisa porsi tetap jadi stok hari berikutnya"
                      }
                      className="ml-2 rounded-md bg-[#333] px-2 py-0.5 text-xs font-semibold text-[#d6c7ae]"
                    >
                      {item.resetDaily ? "Harian" : "Tahan lama"}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-[#ababab]">
                    Bahan: {describeBahan(item.components) || "-"}
                  </p>
                  {item.portionSize > 0 && (
                    <p className="mt-0.5 text-xs text-[#ababab]">
                      1 porsi = {quantityDisplay(item.portionSize, "gr")}
                    </p>
                  )}
                </td>
                <td className="p-4 text-center">
                  <span className="block whitespace-nowrap text-lg font-bold">
                    {quantityDisplay(item.stock, item.unit)}
                  </span>
                  {item.status === "HARUS MASAK" && (
                    <span
                      className={`mt-1 inline-flex items-center justify-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${
                        STOCK_STATUS_CLASS_NAMES[item.status]
                      }`}
                    >
                      {item.status}
                    </span>
                  )}
                </td>
                <td className="p-4 text-center text-sm">
                  {lastProduction ? (
                    <>
                      <span className="block whitespace-nowrap font-semibold">
                        {quantityDisplay(lastProduction.portionQuantity, item.unit)}
                      </span>
                      <span className="block text-xs text-[#d6c7ae]">
                        COGS {costDisplay(lastProduction.unitCost, item.unit)}
                      </span>
                      <span className="mt-1 block text-xs text-[#ababab]">
                        {formatDateAndTime(lastProduction.producedAt)}
                      </span>
                    </>
                  ) : (
                    <span className="text-[#ababab]">Belum pernah dimasak</span>
                  )}
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
                <td className="p-4">
                  <div className="mx-auto flex w-max flex-col gap-2 text-sm">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onProduce(item)}
                        title="Catat hasil masak: bahan baku berkurang, porsi bertambah"
                        className="flex-1 rounded-md bg-[#a79981] px-3 py-1.5 font-bold text-[#101010]"
                      >
                        Catat Masak
                      </button>
                      <button
                        type="button"
                        onClick={() => onWaste(item)}
                        disabled={!hasStock}
                        title={hasStock ? "Catat porsi yang basi atau tumpah" : "Stok kosong"}
                        className="rounded-md border border-red-400/60 px-3 py-1.5 font-semibold text-red-400 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Buang
                      </button>
                    </div>
                    <div className="flex justify-center gap-4 text-xs">
                      <button
                        type="button"
                        onClick={() => onHistory(item)}
                        title="Riwayat Catat Masak"
                        className={linkClass}
                      >
                        Riwayat
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => onEdit(item)}
                            title="Ubah nama, bahan baku, takaran, atau sisa akhir hari"
                            className={linkClass}
                          >
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
                  </div>
                </td>
              </tr>
            );
          })}
          {preparedItems.length === 0 && (
            <tr>
              <td className="p-6 text-center text-sm text-[#ababab]" colSpan={6}>
                Belum ada bahan setengah jadi.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

export default PreparedItemsPanel;
