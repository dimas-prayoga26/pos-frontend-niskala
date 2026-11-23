import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getLoyaltyRedemptions, getLoyaltyStamps } from "../api";
import { formatJakartaReceiptDateTime } from "../../../shared/lib/dates";

const PER_PAGE = 20;
const SEARCH_DELAY_MS = 400;
const cellClass = "px-3 py-2.5";

const errorMessage = (error) => error?.response?.data?.message || "Riwayat gagal dimuat.";

// Stored 6281234567890, shown as the cashier types it: 081234567890.
const localPhone = (phone) => (phone ? String(phone).replace(/^62/, "0") : "-");
const orderCode = (order) => (order ? order.code || `#${order.id}` : null);

const CustomerCell = ({ customer }) => (
  <td className={cellClass}>
    <span className="block font-semibold">{localPhone(customer?.phone)}</span>
    <span className="text-xs text-[#ababab]">{[customer?.code, customer?.name].filter(Boolean).join(" · ")}</span>
  </td>
);

// Stamp Card → Riwayat, newest first: the stamps given (loyalty_stamps, each
// with the order that earned it) and the rewards handed over
// (loyalty_redemptions, with the order they went out in).
const VIEWS = [
  {
    key: "stamps",
    label: "Stamp Masuk",
    queryKey: "loyalty-stamps",
    fetch: getLoyaltyStamps,
    total: (count) => `${count} stamp diberikan`,
    empty: "Belum ada stamp yang diberikan.",
    columns: ["Waktu", "Pelanggan", "Stamp", "Nota", "Kasir"],
    renderRow: (row) => (
      <>
        <td className={`${cellClass} whitespace-nowrap`}>{formatJakartaReceiptDateTime(row.stamped_at)}</td>
        <CustomerCell customer={row.customer} />
        <td className={cellClass}>
          <span className="block">Stamp ke-{row.stamp_number}</span>
          <span className="text-xs text-[#ababab]">{row.card_number}</span>
        </td>
        {/* Given without an order (loyalty:give-stamps): no nota. */}
        <td className={`${cellClass} whitespace-nowrap`}>
          {orderCode(row.order) || <span className="text-[#ababab]">Tanpa nota</span>}
        </td>
        <td className={cellClass}>{row.cashier || "-"}</td>
      </>
    ),
  },
  {
    key: "redemptions",
    label: "Tukar Hadiah",
    queryKey: "loyalty-redemptions",
    fetch: getLoyaltyRedemptions,
    total: (count) => `${count} hadiah ditukar`,
    empty: "Belum ada hadiah yang ditukar.",
    columns: ["Waktu", "Pelanggan", "Hadiah", "Menu", "Nota", "Kasir"],
    renderRow: (row) => (
      <>
        <td className={`${cellClass} whitespace-nowrap`}>{formatJakartaReceiptDateTime(row.redeemed_at)}</td>
        <CustomerCell customer={row.customer} />
        <td className={cellClass}>
          Stamp ke-{row.reward?.stamps} · {row.reward?.label}
        </td>
        <td className={cellClass}>{row.menu_name || "-"}</td>
        <td className={`${cellClass} whitespace-nowrap`}>{orderCode(row.order) || "-"}</td>
        <td className={cellClass}>{row.cashier || "-"}</td>
      </>
    ),
  },
];

export default function StampCardHistoryDialog({ onClose }) {
  const [viewKey, setViewKey] = useState(VIEWS[0].key);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const view = VIEWS.find((candidate) => candidate.key === viewKey);

  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const closeOnEscape = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const historyQuery = useQuery({
    queryKey: [view.queryKey, { page, q }],
    queryFn: () => view.fetch({ page, perPage: PER_PAGE, q }),
    // Keeps the page shown while the next loads, never the other view's rows.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[0] === view.queryKey ? keepPreviousData(previous) : undefined,
    retry: false,
  });
  const history = historyQuery.data?.data?.data;
  const rows = history?.data || [];
  const meta = history?.meta || { page: 1, last_page: 1, total: 0 };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stamp-card-history-title"
        className="flex max-h-[88vh] w-full max-w-5xl flex-col rounded-lg bg-[#1f1f1f] p-5 text-[#f5f5f5] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="stamp-card-history-title" className="text-xl font-bold">
              Riwayat Stamp Card
            </h3>
            <p className="mt-1 text-sm text-[#ababab]">{history ? view.total(meta.total) : " "}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold">
            Tutup
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div role="group" aria-label="Jenis riwayat" className="flex w-fit gap-1 rounded-lg bg-[#262626] p-1">
            {VIEWS.map((option) => (
              <button
                key={option.key}
                type="button"
                aria-pressed={viewKey === option.key}
                onClick={() => {
                  setViewKey(option.key);
                  setPage(1);
                }}
                className={`rounded-md px-4 py-1.5 text-sm font-semibold transition ${
                  viewKey === option.key ? "bg-[#a79981] text-[#101010]" : "text-[#ababab] hover:text-[#f5f5f5]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Cari nomor HP, kode, atau nama"
            aria-label="Cari riwayat"
            className="w-full rounded-lg bg-[#262626] px-4 py-2 text-sm outline-none sm:w-80"
          />
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-lg border border-[#333]">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[#202020] text-[#ababab]">
              <tr>
                {view.columns.map((column) => (
                  <th key={column} className={cellClass}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-[#333]">
                  {view.renderRow(row)}
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={view.columns.length} className={`${cellClass} py-6 text-center text-[#ababab]`}>
                    {historyQuery.isError ? (
                      <span role="alert" className="text-red-300">
                        {errorMessage(historyQuery.error)}
                      </span>
                    ) : !history ? (
                      "Memuat riwayat..."
                    ) : (
                      view.empty
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {meta.last_page > 1 && (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm">
            <button
              type="button"
              onClick={() => setPage((current) => current - 1)}
              disabled={meta.page <= 1 || historyQuery.isFetching}
              className="rounded-lg bg-[#333] px-3 py-1.5 font-semibold disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <span className="text-[#ababab]">
              {meta.page} / {meta.last_page}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => current + 1)}
              disabled={meta.page >= meta.last_page || historyQuery.isFetching}
              className="rounded-lg bg-[#333] px-3 py-1.5 font-semibold disabled:opacity-40"
            >
              Berikutnya
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
