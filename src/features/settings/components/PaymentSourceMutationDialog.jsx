import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { getJakartaDateKey } from "../../../shared/lib/dates";
import { formatNominalInput, normalizeNominalInput } from "../../../shared/lib/format";
import { addPaymentSourceMutation } from "../api";
import { formatSaldo } from "../utils/paymentSources";

const inputClass =
  "mt-2 w-full rounded-lg border border-transparent bg-[#262626] px-4 py-3 text-sm text-[#f5f5f5] outline-none focus:border-[#a79981]";
const TYPES = [
  { id: "in", label: "Saldo Masuk", hint: "Modal awal, setoran, atau uang yang ditambahkan." },
  { id: "out", label: "Saldo Keluar", hint: "Uang diambil atau dipakai di luar belanja bahan." },
];

// Records saldo masuk / keluar of one payment source by hand. Purchases post
// their saldo keluar themselves.
const PaymentSourceMutationDialog = ({ source, onClose }) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ type: "in", amount: "", date: getJakartaDateKey(), note: "" });
  const amount = Number(normalizeNominalInput(form.amount) || 0);
  const balanceAfter = source.balance + (form.type === "in" ? amount : -amount);

  const mutation = useMutation({
    mutationFn: addPaymentSourceMutation,
    onSuccess: async () => {
      enqueueSnackbar(`Saldo ${source.name} tersimpan.`, { variant: "success" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["payment-sources"] }),
        queryClient.invalidateQueries({ queryKey: ["payment-source-mutations"] }),
      ]);
      onClose();
    },
    onError: (error) =>
      enqueueSnackbar(error?.response?.data?.message || "Gagal menyimpan saldo.", { variant: "error" }),
  });

  const submit = (event) => {
    event.preventDefault();
    if (mutation.isPending) return;
    if (amount <= 0) {
      enqueueSnackbar("Isi nominal lebih dari 0.", { variant: "warning" });
      return;
    }
    mutation.mutate({
      id: source.id,
      type: form.type,
      amount,
      date: form.date,
      note: form.note.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-source-mutation-title"
    >
      <form onSubmit={submit} className="w-full max-w-md rounded-xl bg-[#1f1f1f] p-5 text-[#f5f5f5] shadow-xl">
        <h2 id="payment-source-mutation-title" className="text-xl font-bold">
          Catat Saldo {source.name}
        </h2>
        <p className="mt-1 text-sm text-[#ababab]">Saldo sekarang {formatSaldo(source.balance)}</p>

        <fieldset disabled={mutation.isPending} className="mt-4">
          <legend className="text-sm font-semibold text-[#ababab]">Jenis</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                aria-pressed={form.type === type.id}
                onClick={() => setForm((current) => ({ ...current, type: type.id }))}
                className={`rounded-lg px-3 py-2 text-sm font-bold ${
                  form.type === type.id
                    ? type.id === "in"
                      ? "bg-green-700 text-white"
                      : "bg-red-700 text-white"
                    : "bg-[#262626] text-[#ababab] hover:bg-[#333]"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[#ababab]">{TYPES.find((type) => type.id === form.type).hint}</p>

          <label className="mt-4 block text-sm font-semibold text-[#ababab]">
            Nominal
            <div className="mt-2 flex overflow-hidden rounded-lg bg-[#262626]">
              <span className="flex shrink-0 items-center px-4 text-sm font-bold text-[#a79981]">Rp</span>
              <input
                value={formatNominalInput(form.amount)}
                onChange={(event) => setForm((current) => ({ ...current, amount: normalizeNominalInput(event.target.value) }))}
                type="text"
                inputMode="numeric"
                aria-label="Nominal"
                placeholder="0"
                className="min-w-0 w-full bg-transparent py-3 pr-4 text-sm text-[#f5f5f5] outline-none"
              />
            </div>
          </label>
          <label className="mt-4 block text-sm font-semibold text-[#ababab]">
            Tanggal
            <input
              required
              type="date"
              value={form.date}
              onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
              className={inputClass}
            />
          </label>
          <label className="mt-4 block text-sm font-semibold text-[#ababab]">
            Keterangan (opsional)
            <input
              maxLength={255}
              value={form.note}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
              placeholder={form.type === "in" ? "Contoh: Modal awal" : "Contoh: Ambil untuk ongkir"}
              className={inputClass}
            />
          </label>
        </fieldset>

        <p className="mt-4 text-sm text-[#ababab]">
          Saldo setelah dicatat:{" "}
          <strong className={balanceAfter < 0 ? "text-red-400" : "text-[#f5f5f5]"}>{formatSaldo(balanceAfter)}</strong>
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5] disabled:opacity-60"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-lg bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010] disabled:opacity-60"
          >
            {mutation.isPending ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PaymentSourceMutationDialog;
