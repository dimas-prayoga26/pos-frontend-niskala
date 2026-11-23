import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getMenuItemSales } from "../../https";
import { formatJakartaReceiptDateTime } from "../../shared/lib/dates";
import { formatCurrency } from "../../utils";

const PER_PAGE = 20;
const cellClass = "px-3 py-2.5";

const errorMessage = (error) => error?.response?.data?.message || "Riwayat gagal dimuat.";

// Menu → Promo → Riwayat on a promo card: who bought it (each order line of
// this menu, newest first) and how many in all.
export default function PromoSalesDialog({ menu, onClose }) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    const closeOnEscape = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const salesQuery = useQuery({
    queryKey: ["menu-item-sales", menu.id, { page }],
    queryFn: () => getMenuItemSales({ menuItemId: menu.id, page, perPage: PER_PAGE }),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const sales = salesQuery.data?.data?.data;
  const rows = sales?.data || [];
  const meta = sales?.meta || { page: 1, lastPage: 1, total: 0 };
  const summary = sales?.summary;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="promo-sales-title"
        className="flex max-h-[88vh] w-full max-w-4xl flex-col rounded-lg bg-[#1f1f1f] p-5 text-[#f5f5f5] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="promo-sales-title" className="text-xl font-bold">
              Riwayat {menu.name}
            </h3>
            <p className="mt-1 text-sm text-[#ababab]">
              {summary
                ? `${summary.orders} nota · ${summary.quantity} terjual · ${formatCurrency(summary.revenue)}`
                : " "}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold">
            Tutup
          </button>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-auto rounded-lg border border-[#333]">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[#202020] text-[#ababab]">
              <tr>
                <th className={cellClass}>Waktu</th>
                <th className={cellClass}>Nota</th>
                <th className={cellClass}>Pelanggan</th>
                <th className={cellClass}>Tipe</th>
                <th className={`${cellClass} text-right`}>Jumlah</th>
                <th className={`${cellClass} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-[#333]">
                  <td className={`${cellClass} whitespace-nowrap`}>{formatJakartaReceiptDateTime(row.orderDate)}</td>
                  <td className={`${cellClass} whitespace-nowrap`}>{row.orderCode || `#${row.orderId}`}</td>
                  <td className={cellClass}>
                    <span className="block font-semibold">{row.customerName || "-"}</span>
                    {row.customerPhone && <span className="text-xs text-[#ababab]">{row.customerPhone}</span>}
                  </td>
                  <td className={cellClass}>{row.orderType || "-"}</td>
                  <td className={`${cellClass} text-right`}>{row.quantity}</td>
                  <td className={`${cellClass} whitespace-nowrap text-right`}>{formatCurrency(row.price)}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={6} className={`${cellClass} py-6 text-center text-[#ababab]`}>
                    {salesQuery.isError ? (
                      <span role="alert" className="text-red-300">
                        {errorMessage(salesQuery.error)}
                      </span>
                    ) : salesQuery.isPending ? (
                      "Memuat riwayat..."
                    ) : (
                      "Belum ada yang membeli promo ini."
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {meta.lastPage > 1 && (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm">
            <button
              type="button"
              onClick={() => setPage((current) => current - 1)}
              disabled={meta.page <= 1 || salesQuery.isFetching}
              className="rounded-lg bg-[#333] px-3 py-1.5 font-semibold disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <span className="text-[#ababab]">
              {meta.page} / {meta.lastPage}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => current + 1)}
              disabled={meta.page >= meta.lastPage || salesQuery.isFetching}
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
