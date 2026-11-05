import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDateAndTime, getJakartaDateKey } from "../../../../shared/lib/dates";
import { getStockOpnames } from "../../api";
import { quantityDisplay } from "../../utils/format";
import { costClassName, formatDay, groupByDay, latestIdByItem as findLatestIds, periodTotals } from "../../utils/lossHistory";
import { valueChangeDisplay } from "../../utils/opname";
import { STOCK_PAGE_SIZE } from "../../utils/stockItems";

const KIND_TEXTS = {
  raw: { description: "Selisih stok fisik bahan baku dengan sistem.", empty: "Belum ada stock opname bahan baku." },
  semi: { description: "Selisih stok fisik bahan olahan dengan sistem.", empty: "Belum ada stock opname bahan olahan." },
};

const pagerButtonClass =
  "rounded-lg bg-[#262626] px-3 py-2 font-semibold text-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-40";

// "Riwayat Opname" of one kind, opened from its tab of the Stok menu: each
// count that differed from the system stock, under its business day, its
// value as the change in stock value (-Rp kurang, +Rp lebih) and the day's
// total. Admins can undo the latest count of an item.
const OpnamesPanel = ({ kind, isAdmin, onUndo, isUndoing, onBack }) => {
  const [confirmingId, setConfirmingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { data, isPending, isError } = useQuery({
    queryKey: ["stock-opnames", "history", kind],
    queryFn: () => getStockOpnames({ kind }),
  });
  const opnames = data?.data?.data?.opnames || [];
  const dailyTotals = data?.data?.data?.dailyTotals || [];
  const totalPages = Math.max(Math.ceil(opnames.length / STOCK_PAGE_SIZE), 1);
  // An undo can leave the last page empty.
  const page = Math.min(currentPage, totalPages);
  const days = groupByDay(
    opnames.slice((page - 1) * STOCK_PAGE_SIZE, page * STOCK_PAGE_SIZE),
    dailyTotals,
    (opname) => opname.opnameDate
  );
  const latestIdByItem = findLatestIds(opnames);
  const columnCount = isAdmin ? 7 : 6;

  return (
    <section aria-label="Riwayat opname" className="rounded-lg bg-[#1f1f1f] p-4 text-[#f5f5f5]">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold">Riwayat Opname</h3>
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
        <ul aria-label="Total nilai selisih" className="mb-4 grid gap-3 sm:grid-cols-3">
          {periodTotals(dailyTotals, getJakartaDateKey()).map((period) => (
            <li key={period.label} className="rounded-lg bg-[#262626] p-4">
              <p className="text-sm text-[#ababab]">{period.label}</p>
              <p className={`mt-1 text-xl font-bold ${period.cost === 0 ? "" : costClassName(period.cost)}`}>
                {valueChangeDisplay(period.cost)}
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
              <th className="p-3 text-right">Sistem</th>
              <th className="p-3 text-right">Fisik</th>
              <th className="p-3 text-right">Selisih</th>
              <th className="p-3">Dicatat</th>
              <th className="p-3 text-right">Nilai</th>
              {isAdmin && <th className="p-3 text-right">Aksi</th>}
            </tr>
          </thead>
          {days.length === 0 && (
            <tbody>
              <tr>
                <td colSpan={columnCount} className="p-4 text-center text-[#ababab]">
                  {isPending
                    ? "Memuat riwayat opname..."
                    : isError
                      ? "Riwayat opname belum bisa dimuat."
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
                <td
                  className={`whitespace-nowrap p-3 text-right font-bold ${day.cost === 0 ? "" : costClassName(day.cost)}`}
                >
                  {valueChangeDisplay(day.cost)}
                </td>
                {isAdmin && <td />}
              </tr>
              {day.rows.map((opname) => (
                <tr key={opname.id} className="border-t border-[#333]">
                  <td className="p-3">
                    <span className="font-semibold">{opname.itemName}</span>
                    {opname.note && <span className="block text-xs text-[#ababab]">{opname.note}</span>}
                  </td>
                  <td className="whitespace-nowrap p-3 text-right">{quantityDisplay(opname.systemStock, opname.unit)}</td>
                  <td className="whitespace-nowrap p-3 text-right">{quantityDisplay(opname.actualStock, opname.unit)}</td>
                  <td className={`whitespace-nowrap p-3 text-right font-semibold ${costClassName(opname.difference)}`}>
                    {opname.difference > 0
                      ? `kurang ${quantityDisplay(opname.difference, opname.unit)}`
                      : `lebih ${quantityDisplay(-opname.difference, opname.unit)}`}
                  </td>
                  <td className="whitespace-nowrap p-3 text-xs text-[#ababab]">
                    {formatDateAndTime(opname.createdAt)}
                    {opname.userName && <span className="block">{opname.userName}</span>}
                  </td>
                  <td className="whitespace-nowrap p-3 text-right">
                    <span className={`font-semibold ${costClassName(opname.cost)}`}>{valueChangeDisplay(opname.cost)}</span>
                  </td>
                  {isAdmin && (
                    <td className="whitespace-nowrap p-3 text-right">
                      {latestIdByItem.get(opname.itemId) === opname.id &&
                        (confirmingId === opname.id ? (
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
                              onClick={() => onUndo(opname)}
                              className="rounded-md bg-red-500 px-3 py-1 text-xs font-bold text-white disabled:opacity-60"
                            >
                              {isUndoing ? "Membatalkan..." : "Ya, batalkan"}
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmingId(opname.id)}
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

      {opnames.length > STOCK_PAGE_SIZE && (
        <div className="mt-4 flex flex-col gap-3 text-sm text-[#ababab] sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing {(page - 1) * STOCK_PAGE_SIZE + 1}
            {" - "}
            {Math.min(page * STOCK_PAGE_SIZE, opnames.length)} of {opnames.length}
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

export default OpnamesPanel;
