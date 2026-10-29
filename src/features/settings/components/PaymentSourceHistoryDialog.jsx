import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getPaymentSourceMutations } from "../api";
import { formatSaldo, getMutationLabel } from "../utils/paymentSources";

const Stat = ({ label, value, className = "" }) => (
  <div className="rounded-lg bg-[#262626] p-3">
    <span className="block text-xs font-semibold text-[#ababab]">{label}</span>
    <strong className={`mt-1 block ${className}`.trim()}>{value}</strong>
  </div>
);

// Riwayat mutasi: every saldo masuk / keluar of one source, newest first.
const PaymentSourceHistoryDialog = ({ source, onClose }) => {
  const [page, setPage] = useState(1);
  const history = useQuery({
    queryKey: ["payment-source-mutations", source.id, page],
    queryFn: () => getPaymentSourceMutations({ id: source.id, page }),
    placeholderData: keepPreviousData,
  });
  const data = history.data?.data?.data;
  const mutations = data?.mutations || [];
  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / (data?.pageSize || 20)));

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-source-history-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-[#1f1f1f] p-5 text-[#f5f5f5] shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#333] pb-4">
          <div>
            <h2 id="payment-source-history-title" className="text-xl font-bold">
              Riwayat Saldo {source.name}
            </h2>
            <p className="mt-1 text-sm text-[#ababab]">Saldo masuk dan keluar, terbaru di atas.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5]"
          >
            Tutup
          </button>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          <Stat
            label="Saldo Sekarang"
            value={formatSaldo(data?.source?.balance ?? source.balance)}
            className={(data?.source?.balance ?? source.balance) < 0 ? "text-red-400" : ""}
          />
          <Stat label="Total Saldo Masuk" value={formatSaldo(data?.totalIn || 0)} className="text-green-400" />
          <Stat label="Total Saldo Keluar" value={formatSaldo(data?.totalOut || 0)} className="text-red-300" />
        </div>

        {history.isError ? (
          <p role="alert" className="py-4 text-red-300">
            Riwayat saldo gagal dimuat.{" "}
            <button type="button" onClick={() => history.refetch()} className="underline">
              Coba lagi
            </button>
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[#ababab]">
                <tr>
                  <th className="p-2">Tanggal</th>
                  <th className="p-2">Keterangan</th>
                  <th className="p-2 text-right">Saldo Masuk</th>
                  <th className="p-2 text-right">Saldo Keluar</th>
                  <th className="p-2 text-right">Saldo Akhir</th>
                  <th className="p-2">Oleh</th>
                </tr>
              </thead>
              <tbody>
                {mutations.map((mutation) => (
                  <tr key={mutation.id} className="border-t border-[#444]">
                    <td className="whitespace-nowrap p-2">{String(mutation.date).slice(0, 10)}</td>
                    <td className="p-2">
                      {mutation.note || "-"}
                      <p className="text-xs text-[#ababab]">{getMutationLabel(mutation)}</p>
                    </td>
                    <td className="p-2 text-right text-green-400">
                      {mutation.amountIn ? formatSaldo(mutation.amountIn) : "-"}
                    </td>
                    <td className="p-2 text-right text-red-300">
                      {mutation.amountOut ? formatSaldo(mutation.amountOut) : "-"}
                    </td>
                    <td className={`p-2 text-right font-semibold ${mutation.balanceAfter < 0 ? "text-red-400" : ""}`}>
                      {formatSaldo(mutation.balanceAfter)}
                    </td>
                    <td className="p-2 text-[#ababab]">{mutation.userName || "-"}</td>
                  </tr>
                ))}
                {!history.isPending && !mutations.length && (
                  <tr>
                    <td className="p-4 text-center text-[#ababab]" colSpan={6}>
                      Belum ada saldo masuk atau keluar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {history.isPending && <p className="py-4 text-center text-sm text-[#ababab]">Memuat riwayat saldo...</p>}
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1 || history.isFetching}
            onClick={() => setPage((current) => current - 1)}
            className="disabled:opacity-40"
          >
            Sebelumnya
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || history.isFetching}
            onClick={() => setPage((current) => current + 1)}
            className="disabled:opacity-40"
          >
            Berikutnya
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSourceHistoryDialog;
