import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getLoyaltyRedemptions } from "../api";
import { formatJakartaReceiptDateTime } from "../../../shared/lib/dates";

const PER_PAGE = 20;
const SEARCH_DELAY_MS = 400;
const cellClass = "px-3 py-2.5";

const errorMessage = (error) => error?.response?.data?.message || "Riwayat gagal dimuat.";

// Stored 6281234567890, shown as the cashier types it: 081234567890.
const localPhone = (phone) => (phone ? String(phone).replace(/^62/, "0") : "-");

// Program Promo → Riwayat: every reward handed over (loyalty_redemptions),
// newest first, with the order it went out in and the cashier.
export default function RedemptionHistoryDialog({ onClose }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");

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
    queryKey: ["loyalty-redemptions", { page, q }],
    queryFn: () => getLoyaltyRedemptions({ page, perPage: PER_PAGE, q }),
    placeholderData: keepPreviousData,
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
        aria-labelledby="redemption-history-title"
        className="flex max-h-[88vh] w-full max-w-5xl flex-col rounded-lg bg-[#1f1f1f] p-5 text-[#f5f5f5] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="redemption-history-title" className="text-xl font-bold">
              Riwayat Tukar Hadiah
            </h3>
            <p className="mt-1 text-sm text-[#ababab]">{meta.total} hadiah ditukar</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold">
            Tutup
          </button>
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
          className="mt-4 w-full rounded-lg bg-[#262626] px-4 py-2 text-sm outline-none sm:w-80"
        />

        <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-lg border border-[#333]">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[#202020] text-[#ababab]">
              <tr>
                <th className={cellClass}>Waktu</th>
                <th className={cellClass}>Pelanggan</th>
                <th className={cellClass}>Hadiah</th>
                <th className={cellClass}>Menu</th>
                <th className={cellClass}>Nota</th>
                <th className={cellClass}>Kasir</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-[#333]">
                  <td className={`${cellClass} whitespace-nowrap`}>{formatJakartaReceiptDateTime(row.redeemed_at)}</td>
                  <td className={cellClass}>
                    <span className="block font-semibold">{localPhone(row.customer?.phone)}</span>
                    <span className="text-xs text-[#ababab]">
                      {[row.customer?.code, row.customer?.name].filter(Boolean).join(" · ")}
                    </span>
                  </td>
                  <td className={cellClass}>
                    Stamp ke-{row.reward?.stamps} · {row.reward?.label}
                  </td>
                  <td className={cellClass}>{row.menu_name || "-"}</td>
                  <td className={`${cellClass} whitespace-nowrap`}>{row.order ? row.order.code || `#${row.order.id}` : "-"}</td>
                  <td className={cellClass}>{row.cashier || "-"}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={6} className={`${cellClass} py-6 text-center text-[#ababab]`}>
                    {historyQuery.isPending ? (
                      "Memuat riwayat..."
                    ) : historyQuery.isError ? (
                      <span role="alert" className="text-red-300">
                        {errorMessage(historyQuery.error)}
                      </span>
                    ) : (
                      "Belum ada hadiah yang ditukar."
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
