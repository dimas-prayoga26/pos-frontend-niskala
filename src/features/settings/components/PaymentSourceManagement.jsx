import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { addPaymentSource, getPaymentSources, updatePaymentSource } from "../api";
import { formatSaldo } from "../utils/paymentSources";
import PaymentSourceHistoryDialog from "./PaymentSourceHistoryDialog";
import PaymentSourceMutationDialog from "./PaymentSourceMutationDialog";

const inputClass =
  "w-full rounded-lg border border-transparent bg-[#262626] px-4 py-3 text-sm text-[#f5f5f5] outline-none focus:border-[#a79981] disabled:opacity-60";
const actionClass =
  "rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50";
const emptyForm = { name: "", isActive: true };

// Sumber pembayaran (Kasir (Tunai), Rekening Penjualan, Niskala, ...) with
// their saldo. Purchases take saldo keluar from the source chosen in the
// form; saldo masuk is recorded here.
export default function PaymentSourceManagement() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [mutationSource, setMutationSource] = useState(null);
  const [historySource, setHistorySource] = useState(null);
  const nameInput = useRef(null);
  const sources = useQuery({
    queryKey: ["payment-sources", "management"],
    queryFn: () => getPaymentSources({ includeInactive: true }),
  });
  const list = sources.data?.data?.data || [];
  const activeTotal = list.filter((source) => source.isActive).reduce((sum, source) => sum + source.balance, 0);
  // Dialogs read the refetched row so the saldo shown is current.
  const findFresh = (source) => source && (list.find((item) => item.id === source.id) || source);

  const reset = () => {
    setForm(emptyForm);
    setEditingId(null);
  };
  const saveMutation = useMutation({
    mutationFn: ({ id, ...data }) => (id ? updatePaymentSource({ id, ...data }) : addPaymentSource(data)),
    onSuccess: async () => {
      enqueueSnackbar(editingId ? "Sumber pembayaran diubah." : "Sumber pembayaran ditambahkan.", {
        variant: "success",
      });
      reset();
      await queryClient.invalidateQueries({ queryKey: ["payment-sources"] });
    },
    onError: (error) =>
      enqueueSnackbar(error?.response?.data?.message || "Gagal menyimpan sumber pembayaran.", {
        variant: "error",
      }),
  });

  const submit = (event) => {
    event.preventDefault();
    if (saveMutation.isPending) return;
    const name = form.name.trim().replace(/\s+/g, " ");
    if (!name) {
      enqueueSnackbar("Nama sumber pembayaran wajib diisi.", { variant: "warning" });
      return;
    }
    saveMutation.mutate({ id: editingId, name, isActive: form.isActive });
  };

  const startEdit = (source) => {
    setEditingId(source.id);
    setForm({ name: source.name, isActive: source.isActive });
    nameInput.current?.focus();
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
      <form onSubmit={submit} className="self-start rounded-lg bg-[#1f1f1f] p-4">
        <h3 className="text-lg font-bold text-[#f5f5f5]">
          {editingId ? "Ubah Sumber Pembayaran" : "Tambah Sumber Pembayaran"}
        </h3>
        <p className="mt-1 text-sm text-[#ababab]">Asal uang untuk membayar belanja bahan.</p>
        <label className="mt-4 block text-sm font-semibold text-[#ababab]">
          Nama Sumber
          <input
            ref={nameInput}
            maxLength={100}
            value={form.name}
            disabled={saveMutation.isPending}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Contoh: Kasir (Tunai)"
            className={`mt-2 ${inputClass}`}
          />
        </label>
        <label className="mt-4 flex items-center gap-3 text-sm font-semibold text-[#ababab]">
          <input
            type="checkbox"
            checked={form.isActive}
            disabled={saveMutation.isPending}
            onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
            className="h-4 w-4 accent-[#a79981]"
          />
          Aktif (bisa dipilih di form belanja)
        </label>
        <div className="mt-5 flex gap-2">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="rounded-lg bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010] disabled:opacity-60"
          >
            {saveMutation.isPending ? "Menyimpan..." : editingId ? "Simpan" : "Tambah"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={reset}
              disabled={saveMutation.isPending}
              className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5] disabled:opacity-60"
            >
              Batal
            </button>
          )}
        </div>
      </form>

      <div className="min-w-0 rounded-lg bg-[#1f1f1f] p-4">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <h3 className="text-lg font-bold text-[#f5f5f5]">Saldo Sumber Pembayaran</h3>
          <p className="text-sm text-[#ababab]">
            Total saldo aktif:{" "}
            <strong className={activeTotal < 0 ? "text-red-400" : "text-[#f5f5f5]"}>{formatSaldo(activeTotal)}</strong>
          </p>
        </div>
        {sources.isError ? (
          <p role="alert" className="py-4 text-red-300">
            Sumber pembayaran gagal dimuat.{" "}
            <button type="button" onClick={() => sources.refetch()} className="underline">
              Coba lagi
            </button>
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[#f5f5f5]">
              <thead className="bg-[#333] text-[#ababab]">
                <tr>
                  <th className="p-3">Sumber</th>
                  <th className="p-3 text-right">Saldo</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {list.map((source) => (
                  <tr key={source.id} className="border-b border-[#444] hover:bg-[#292929]">
                    <td className="break-words p-4 font-semibold">{source.name}</td>
                    <td className={`p-4 text-right font-bold ${source.balance < 0 ? "text-red-400" : ""}`}>
                      {formatSaldo(source.balance)}
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`inline-flex rounded-md px-3 py-1 text-xs font-bold ${
                          source.isActive ? "bg-green-900/60 text-green-300" : "bg-red-900/60 text-red-300"
                        }`}
                      >
                        {source.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setMutationSource(source)}
                          aria-label={`Catat saldo ${source.name}`}
                          className={`${actionClass} border-green-500/40 text-green-300 hover:bg-green-500/10`}
                        >
                          Catat Saldo
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistorySource(source)}
                          aria-label={`Riwayat saldo ${source.name}`}
                          className={`${actionClass} border-[#a79981]/40 text-[#d6c7ae] hover:bg-[#a79981]/10`}
                        >
                          Riwayat
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(source)}
                          disabled={saveMutation.isPending}
                          aria-label={`Ubah ${source.name}`}
                          className={`${actionClass} border-[#555] text-[#f5f5f5] hover:bg-[#333]`}
                        >
                          Ubah
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sources.isPending ? (
              <p className="py-5 text-center text-sm text-[#ababab]">Memuat sumber pembayaran...</p>
            ) : (
              !list.length && <p className="py-5 text-center text-sm text-[#ababab]">Belum ada sumber pembayaran.</p>
            )}
          </div>
        )}
      </div>

      {mutationSource && (
        <PaymentSourceMutationDialog source={findFresh(mutationSource)} onClose={() => setMutationSource(null)} />
      )}
      {historySource && (
        <PaymentSourceHistoryDialog source={findFresh(historySource)} onClose={() => setHistorySource(null)} />
      )}
    </div>
  );
}
