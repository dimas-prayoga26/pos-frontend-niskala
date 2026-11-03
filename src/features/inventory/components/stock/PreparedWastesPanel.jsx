import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDateAndTime } from "../../../../shared/lib/dates";
import { getSemiWastes } from "../../api";
import { quantityDisplay, signedCurrency } from "../../utils/format";
import { STOCK_PAGE_SIZE } from "../../utils/stockItems";

const REASON_CLASS_NAMES = {
  "Sisa akhir hari": "bg-[#3b3b3b] text-[#d6c7ae]",
  Penyesuaian: "bg-[#2f3a4a] text-[#a9c7f5]",
};

const pagerButtonClass =
  "rounded-lg bg-[#262626] px-3 py-2 font-semibold text-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-40";

const costClassName = (cost) => (cost < 0 ? "text-green-400" : "text-red-400");

const formatDay = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

// The write-offs (newest first) per business day, each day with its total
// kerugian from the server (all its rows, not only the ones listed).
const groupByDay = (wastes, dailyTotals) => {
  const totalByDate = new Map(dailyTotals.map((day) => [day.date, day.cost]));
  const days = [];

  for (const waste of wastes) {
    if (days[days.length - 1]?.date !== waste.wasteDate) days.push({ date: waste.wasteDate, wastes: [] });
    days[days.length - 1].wastes.push(waste);
  }

  return days.map((day) => ({
    ...day,
    cost: totalByDate.get(day.date) ?? day.wastes.reduce((total, waste) => total + waste.cost, 0),
  }));
};

// "Riwayat Kerugian", opened from the Bahan Setengah Jadi tab of the Stok menu:
// portions of bahan setengah jadi thrown away (leftover at the daily recap,
// spoiled, spilled, a lower stock count), a page of write-offs at a time under
// their day. Admins can undo the latest write-off of an item.
const PreparedWastesPanel = ({ isAdmin, onUndo, isUndoing, onBack }) => {
  const [confirmingId, setConfirmingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { data, isPending, isError } = useQuery({
    queryKey: ["semi-wastes", "history"],
    queryFn: () => getSemiWastes(),
  });
  const wastes = data?.data?.data?.wastes || [];
  const totalPages = Math.max(Math.ceil(wastes.length / STOCK_PAGE_SIZE), 1);
  // An undo can leave the last page empty.
  const page = Math.min(currentPage, totalPages);
  const days = groupByDay(
    wastes.slice((page - 1) * STOCK_PAGE_SIZE, page * STOCK_PAGE_SIZE),
    data?.data?.data?.dailyTotals || []
  );
  // The newest write-off of each item (highest id) is the one that can be undone.
  const latestIdByItem = new Map();
  for (const waste of wastes) {
    if (waste.semiItemId && waste.id > (latestIdByItem.get(waste.semiItemId) || 0)) {
      latestIdByItem.set(waste.semiItemId, waste.id);
    }
  }

  return (
    <section aria-label="Riwayat kerugian" className="rounded-lg bg-[#1f1f1f] p-4 text-[#f5f5f5]">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold">Riwayat Kerugian</h3>
          <p className="mt-1 text-sm text-[#ababab]">
            Porsi bahan setengah jadi yang dibuang, dihitung dengan harga per porsi saat itu.
          </p>
        </div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5] hover:bg-[#3a3a3a]"
          >
            Kembali
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#333] text-[#ababab]">
            <tr>
              <th className="p-3">Bahan</th>
              <th className="p-3 text-right">Jumlah</th>
              <th className="p-3">Alasan</th>
              <th className="p-3">Dicatat</th>
              <th className="p-3 text-right">Kerugian</th>
              {isAdmin && <th className="p-3 text-right">Aksi</th>}
            </tr>
          </thead>
          {days.length === 0 && (
            <tbody>
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="p-4 text-center text-[#ababab]">
                  {isPending
                    ? "Memuat riwayat kerugian..."
                    : isError
                      ? "Riwayat kerugian belum bisa dimuat."
                      : "Belum ada porsi yang dibuang."}
                </td>
              </tr>
            </tbody>
          )}
          {days.map((day) => (
            <tbody key={day.date}>
              <tr className="border-t border-[#444] bg-[#262626]">
                <td colSpan={4} className="p-3 font-semibold">
                  {formatDay(day.date)}
                </td>
                <td className={`whitespace-nowrap p-3 text-right font-bold ${costClassName(day.cost)}`}>
                  {signedCurrency(day.cost)}
                </td>
                {isAdmin && <td />}
              </tr>
              {day.wastes.map((waste) => (
                <tr key={waste.id} className="border-t border-[#333]">
                  <td className="p-3">
                    <span className="font-semibold">{waste.itemName}</span>
                    {waste.note && <span className="block text-xs text-[#ababab]">{waste.note}</span>}
                  </td>
                  <td className="whitespace-nowrap p-3 text-right">
                    {/* A recount above the stock: a selisih lebih, not a loss. */}
                    {waste.quantity < 0
                      ? `lebih ${quantityDisplay(-waste.quantity, waste.unit)}`
                      : quantityDisplay(waste.quantity, waste.unit)}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${
                        REASON_CLASS_NAMES[waste.reason] || "bg-[#4a2e2e] text-red-300"
                      }`}
                    >
                      {waste.reason}
                    </span>
                  </td>
                  <td className="whitespace-nowrap p-3 text-xs text-[#ababab]">
                    {formatDateAndTime(waste.createdAt)}
                    {waste.userName && <span className="block">{waste.userName}</span>}
                  </td>
                  <td className="whitespace-nowrap p-3 text-right">
                    <span className={`font-semibold ${costClassName(waste.cost)}`}>{signedCurrency(waste.cost)}</span>
                  </td>
                  {isAdmin && (
                    <td className="whitespace-nowrap p-3 text-right">
                      {latestIdByItem.get(waste.semiItemId) === waste.id &&
                        (confirmingId === waste.id ? (
                          <span className="inline-flex gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmingId(null)}
                              className="rounded-md bg-[#333] px-3 py-1 text-xs font-semibold"
                            >
                              Tidak
                            </button>
                            <button
                              type="button"
                              disabled={isUndoing}
                              onClick={() => onUndo(waste.id)}
                              className="rounded-md bg-red-500 px-3 py-1 text-xs font-bold text-white disabled:opacity-60"
                            >
                              {isUndoing ? "Membatalkan..." : "Ya, kembalikan ke stok"}
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmingId(waste.id)}
                            className="rounded-md bg-[#333] px-3 py-1 text-xs font-semibold text-red-400"
                          >
                            Batalkan
                          </button>
                        ))}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      {wastes.length > STOCK_PAGE_SIZE && (
        <div className="mt-4 flex flex-col gap-3 text-sm text-[#ababab] sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing {(page - 1) * STOCK_PAGE_SIZE + 1}
            {" - "}
            {Math.min(page * STOCK_PAGE_SIZE, wastes.length)} of {wastes.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(Math.max(page - 1, 1))}
              disabled={page === 1}
              className={pagerButtonClass}
            >
              Prev
            </button>
            <span className="px-2 font-semibold text-[#f5f5f5]">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage(Math.min(page + 1, totalPages))}
              disabled={page === totalPages}
              className={pagerButtonClass}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default PreparedWastesPanel;
