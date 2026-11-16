import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import OrderDateRangeFilter from "../../../orders/components/OrderDateRangeFilter";
import { getShoppingActivityLogs } from "../../api";
import { PERIOD_OPTIONS, periodRange, rangeLabel, rangeParams } from "../../utils/periods";
import { getLogActionLabel, getLogDetail } from "../../utils/shopping";

const actionTone = {
  create: "text-emerald-300",
  delete: "text-red-300",
};
const fieldClass =
  "rounded-lg border border-[#555] bg-[#262626] px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#d6c7ae]";
const pageButtonClass =
  "rounded-md px-3 py-1.5 text-sm font-semibold text-[#ababab] hover:bg-[#333] hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

// History of Belanja (admins): every purchase line made, changed or deleted,
// bahan baku and barang lainnya together, newest first, 10 a page, for a
// period of days like the Belanja page (the server pages, filters and
// searches). Escape or a backdrop click closes it.
const ShoppingActivityLogDialog = ({ onClose }) => {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("all");
  const [customRange, setCustomRange] = useState({ from: "", to: "" });
  const [page, setPage] = useState(1);
  const range = periodRange(period, customRange);

  // Searches once typing stops, from page 1; an unchanged search keeps the page.
  useEffect(() => {
    const nextSearch = searchInput.trim();
    if (nextSearch === search) return undefined;

    const timer = setTimeout(() => {
      setSearch(nextSearch);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  useEffect(() => {
    const closeOnEscape = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["shopping-activity-logs", page, search, range.from, range.to],
    queryFn: () => getShoppingActivityLogs({ page, ...(search && { search }), ...rangeParams(range) }),
    placeholderData: keepPreviousData,
    // Loaded when asked; no refresh in the background.
    refetchInterval: false,
  });
  const result = data?.data?.data;
  const logs = result?.logs || [];
  const total = result?.total || 0;
  const pageSize = result?.pageSize || 10;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const firstShown = total ? (page - 1) * pageSize + 1 : 0;
  const lastShown = Math.min(page * pageSize, total);

  const choosePeriod = (nextPeriod) => {
    setPeriod(nextPeriod);
    setPage(1);
  };
  const chooseCustomRange = (nextRange) => {
    setCustomRange(nextRange);
    setPage(1);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shopping-activity-title"
        className="flex max-h-[88vh] w-full max-w-5xl flex-col rounded-lg bg-[#1f1f1f] p-5 text-[#f5f5f5] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="shopping-activity-title" className="text-xl font-bold">History Belanja</h2>
            <p className="mt-1 text-sm text-[#ababab]">Bahan yang ditambah, diubah, dan dihapus.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold">
            Tutup
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div role="group" aria-label="Filter periode history" className="flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="history-period" className="font-semibold text-[#ababab]">
              Periode
            </label>
            <select
              id="history-period"
              value={period}
              onChange={(event) => choosePeriod(event.target.value)}
              className={fieldClass}
            >
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            {period === "custom" && (
              <OrderDateRangeFilter
                label=""
                inputId="history-date-range"
                dateRange={{ startDate: customRange.from, endDate: customRange.to }}
                onChange={({ startDate, endDate }) => chooseCustomRange({ from: startDate, to: endDate })}
              />
            )}
            <span className="text-xs text-[#ababab]">{rangeLabel(range)}</span>
          </div>
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Cari history"
            placeholder="Barang, toko, atau user"
            className="rounded-lg bg-[#262626] px-4 py-2 text-sm text-[#f5f5f5] outline-none sm:w-64"
          />
        </div>

        <div className={`mt-3 min-h-0 flex-1 overflow-auto ${isFetching ? "opacity-70" : ""}`}>
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[#1f1f1f] text-[#ababab]">
              <tr>
                <th className="p-2">Waktu</th>
                <th className="p-2">User</th>
                <th className="p-2">Aksi</th>
                <th className="p-2">Barang</th>
                <th className="p-2">Jenis</th>
                <th className="p-2">Toko</th>
                <th className="p-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-[#333] align-top">
                  <td className="whitespace-nowrap p-2">{new Date(log.createdAt).toLocaleString("id-ID")}</td>
                  <td className="p-2">{log.userName || "-"}</td>
                  <td className={`p-2 font-semibold ${actionTone[log.action] || "text-amber-200"}`}>
                    {getLogActionLabel(log)}
                  </td>
                  <td className="p-2 font-semibold">{log.itemName}</td>
                  <td className="p-2 text-[#ababab]">{log.kind}</td>
                  <td className="p-2 text-[#ababab]">{log.supplierName || "-"}</td>
                  <td className="p-2 text-[#ababab]">{getLogDetail(log)}</td>
                </tr>
              ))}
              {!logs.length && (
                <tr>
                  <td className="p-4 text-center text-[#ababab]" colSpan={7}>
                    {isLoading ? "Memuat..." : isError ? "Gagal memuat history." : "Belum ada history."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-sm text-[#ababab]">
          <span>
            Showing {firstShown} - {lastShown} of {total}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage((current) => current - 1)} disabled={page <= 1} className={pageButtonClass}>
              Prev
            </button>
            <span className="font-semibold text-[#f5f5f5]">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => current + 1)}
              disabled={page >= totalPages}
              className={pageButtonClass}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShoppingActivityLogDialog;
