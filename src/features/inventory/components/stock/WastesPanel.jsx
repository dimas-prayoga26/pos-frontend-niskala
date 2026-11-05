import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { backendBaseUrl } from "../../../../shared/api/backendUrl";
import { formatDateAndTime, getJakartaDateKey } from "../../../../shared/lib/dates";
import { getStockWastes } from "../../api";
import { quantityDisplay, signedCurrency } from "../../utils/format";
import { costClassName, formatDay, groupByDay, latestIdByItem as findLatestIds, periodTotals } from "../../utils/lossHistory";
import { STOCK_PAGE_SIZE } from "../../utils/stockItems";

const REASON_CLASS_NAMES = {
  "Sisa akhir hari": "bg-[#3b3b3b] text-[#d6c7ae]",
  Penyesuaian: "bg-[#2f3a4a] text-[#a9c7f5]",
};

// Each tab has its own Riwayat Kerugian.
const KIND_TEXTS = {
  raw: {
    description: "Bahan baku yang dibuang, dihitung dengan harga saat itu.",
    empty: "Belum ada bahan baku yang dibuang.",
  },
  semi: {
    description: "Porsi bahan olahan yang dibuang, dihitung dengan harga per porsi saat itu.",
    empty: "Belum ada porsi yang dibuang.",
  },
};

const pagerButtonClass =
  "rounded-lg bg-[#262626] px-3 py-2 font-semibold text-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-40";

// "Riwayat Kerugian" of one kind, opened from its tab of the Stok menu: bahan
// baku (kind "raw") or bahan olahan (kind "semi") thrown away (Buang,
// the leftover at the daily recap, a lower stock count) with their bukti
// foto, a page of write-offs at a time under their day. Admins can undo the
// latest write-off of an item.
const WastesPanel = ({ kind, isAdmin, onUndo, isUndoing, onBack }) => {
  const [confirmingId, setConfirmingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { data, isPending, isError } = useQuery({
    queryKey: ["stock-wastes", "history", kind],
    queryFn: () => getStockWastes({ kind }),
  });
  const wastes = data?.data?.data?.wastes || [];
  const dailyTotals = data?.data?.data?.dailyTotals || [];
  const totalPages = Math.max(Math.ceil(wastes.length / STOCK_PAGE_SIZE), 1);
  // An undo can leave the last page empty.
  const page = Math.min(currentPage, totalPages);
  const days = groupByDay(
    wastes.slice((page - 1) * STOCK_PAGE_SIZE, page * STOCK_PAGE_SIZE),
    dailyTotals,
    (waste) => waste.wasteDate
  );
  // The newest write-off of each item is the one that can be undone.
  const latestIdByItem = findLatestIds(wastes);
  const columnCount = isAdmin ? 7 : 6;

  return (
    <section aria-label="Riwayat kerugian" className="rounded-lg bg-[#1f1f1f] p-4 text-[#f5f5f5]">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold">Riwayat Kerugian</h3>
          <p className="mt-1 text-sm text-[#ababab]">{KIND_TEXTS[kind].description}</p>
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

      {data && (
        <ul aria-label="Total kerugian" className="mb-4 grid gap-3 sm:grid-cols-3">
          {periodTotals(dailyTotals, getJakartaDateKey()).map((period) => (
            <li key={period.label} className="rounded-lg bg-[#262626] p-4">
              <p className="text-sm text-[#ababab]">{period.label}</p>
              <p className={`mt-1 text-xl font-bold ${period.cost === 0 ? "" : costClassName(period.cost)}`}>
                {signedCurrency(period.cost)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#333] text-[#ababab]">
            <tr>
              <th className="p-3">Bahan</th>
              <th className="p-3 text-right">Jumlah</th>
              <th className="p-3">Alasan</th>
              <th className="p-3">Dicatat</th>
              <th className="p-3">Bukti</th>
              <th className="p-3 text-right">Kerugian</th>
              {isAdmin && <th className="p-3 text-right">Aksi</th>}
            </tr>
          </thead>
          {days.length === 0 && (
            <tbody>
              <tr>
                <td colSpan={columnCount} className="p-4 text-center text-[#ababab]">
                  {isPending
                    ? "Memuat riwayat kerugian..."
                    : isError
                      ? "Riwayat kerugian belum bisa dimuat."
                      : KIND_TEXTS[kind].empty}
                </td>
              </tr>
            </tbody>
          )}
          {days.map((day) => (
            <tbody key={day.date}>
              <tr className="border-t border-[#444] bg-[#262626]">
                <td colSpan={5} className="p-3 font-semibold">
                  {formatDay(day.date)}
                </td>
                <td className={`whitespace-nowrap p-3 text-right font-bold ${costClassName(day.cost)}`}>
                  {signedCurrency(day.cost)}
                </td>
                {isAdmin && <td />}
              </tr>
              {day.rows.map((waste) => (
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
                  <td className="p-3">
                    {waste.photos?.length ? (
                      <span className="flex gap-1">
                        {waste.photos.map((photo, index) => (
                          <a key={photo.id} href={`${backendBaseUrl}${photo.url}`} target="_blank" rel="noreferrer">
                            <img
                              src={`${backendBaseUrl}${photo.url}`}
                              alt={`Bukti buang ${waste.itemName} ${index + 1}`}
                              loading="lazy"
                              className="h-10 w-10 rounded-md border border-[#444] bg-[#181818] object-cover"
                            />
                          </a>
                        ))}
                      </span>
                    ) : (
                      <span className="text-[#777]">-</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap p-3 text-right">
                    <span className={`font-semibold ${costClassName(waste.cost)}`}>{signedCurrency(waste.cost)}</span>
                  </td>
                  {isAdmin && (
                    <td className="whitespace-nowrap p-3 text-right">
                      {latestIdByItem.get(waste.itemId) === waste.id &&
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
                              onClick={() => onUndo(waste)}
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

export default WastesPanel;