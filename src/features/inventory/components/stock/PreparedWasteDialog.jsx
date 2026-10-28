import { useState } from "react";
import { currency, quantityDisplay } from "../../utils/format";
import { getWasteCost } from "../../utils/preparedItems";
import { parseCostInput } from "../../utils/stockItems";

const inputClass =
  "w-full rounded-lg border border-[#555] bg-[#1f1f1f] px-3 py-2 text-[#f5f5f5] outline-none focus:border-[#d6c7ae]";

// Reasons a cashier can pick; "Sisa akhir hari" is written by the daily recap
// and "Penyesuaian" by a lower stock count.
const WASTE_REASONS = ["Basi", "Tumpah", "Lainnya"];

// Portions of a bahan setengah jadi thrown away during the day. They leave the
// stock and are kept as kerugian at the current cost per portion.
const PreparedWasteDialog = ({ item, onSave, onCancel, isSaving }) => {
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState(WASTE_REASONS[0]);
  const [note, setNote] = useState("");
  const portions = parseCostInput(quantity);
  const available = Math.max(Number(item.stock || 0), 0);
  const isValid = Number.isFinite(portions) && portions > 0 && portions <= available;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!isValid) return;

    onSave({ quantity: portions, reason, note: note.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={handleSubmit}
        aria-label="Form buang porsi"
        className="rounded-lg bg-[#262626] p-5 text-[#f5f5f5] shadow-2xl"
        style={{ width: "min(92vw, 420px)" }}
      >
        <h3 className="text-lg font-bold">Buang {item.name}</h3>
        <p className="mt-1 text-sm text-[#ababab]">
          Porsi yang basi atau tumpah keluar dari stok dan dicatat sebagai kerugian. Sisa stok:{" "}
          {quantityDisplay(available, item.unit)}.
        </p>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-semibold">Jumlah dibuang ({item.unit})</span>
          <input
            type="text"
            inputMode="decimal"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className={inputClass}
            placeholder="Contoh: 5"
          />
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-semibold">Alasan</span>
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            aria-label="Alasan"
            className={inputClass}
          >
            {WASTE_REASONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-semibold">Catatan</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className={inputClass}
            placeholder="Opsional"
          />
        </label>

        <div className="mt-4 flex items-center justify-between rounded-lg bg-[#1f1f1f] p-3 text-sm">
          <span className="text-[#ababab]">Kerugian</span>
          <strong className="text-red-400">{currency(getWasteCost(item, quantity))}</strong>
        </div>
        {Number.isFinite(portions) && portions > available && (
          <p className="mt-2 text-xs text-red-400">
            Lebih dari sisa stok ({quantityDisplay(available, item.unit)}).
          </p>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-[#333] px-4 py-2 text-sm font-semibold text-[#f5f5f5]"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={!isValid || isSaving}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Menyimpan..." : "Buang"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PreparedWasteDialog;
