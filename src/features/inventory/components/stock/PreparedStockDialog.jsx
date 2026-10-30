import { useState } from "react";
import { enqueueSnackbar } from "notistack";
import { currency, quantityDisplay } from "../../utils/format";
import { getWasteCost } from "../../utils/preparedItems";
import { parseCostInput } from "../../utils/stockItems";

const inputClass =
  "w-full rounded-lg border border-[#555] bg-[#1f1f1f] px-3 py-2 text-[#f5f5f5] outline-none focus:border-[#d6c7ae]";

// Sets the portions actually left (a recount), at the same cost per portion:
// portions missing from a lower count are kerugian, extra ones of a higher
// count a selisih lebih that lowers it (Penyesuaian both ways).
const PreparedStockDialog = ({ item, onSave, onCancel, isSaving }) => {
  const [stock, setStock] = useState(String(Math.max(Number(item.stock || 0), 0)));
  const counted = parseCostInput(stock);
  const missing = Number.isFinite(counted) ? Number(item.stock || 0) - counted : 0;

  const handleSubmit = (event) => {
    event.preventDefault();

    const value = parseCostInput(stock);
    if (!Number.isFinite(value) || value < 0) {
      enqueueSnackbar("Jumlah stok tidak valid.", { variant: "error" });
      return;
    }

    onSave(value);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={handleSubmit}
        aria-label="Form sesuaikan stok"
        className="rounded-lg bg-[#262626] p-5 text-[#f5f5f5] shadow-2xl"
        style={{ width: "min(92vw, 400px)" }}
      >
        <h3 className="text-lg font-bold">Sesuaikan Stok {item.name}</h3>
        <p className="mt-1 text-sm text-[#ababab]">
          Isi sisa yang benar-benar ada saat dihitung ulang.
        </p>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-semibold">Stok Sekarang ({item.unit})</span>
          <input
            type="text"
            inputMode="decimal"
            value={stock}
            onChange={(event) => setStock(event.target.value)}
            className={inputClass}
          />
        </label>
        {missing > 0 && (
          <p className="mt-2 rounded-lg bg-[#1f1f1f] p-3 text-xs text-[#ababab]">
            Kurang {quantityDisplay(missing, item.unit)} dicatat sebagai kerugian (Penyesuaian):{" "}
            <strong className="text-red-400">{currency(getWasteCost(item, missing))}</strong>
          </p>
        )}
        {missing < 0 && (
          <p className="mt-2 rounded-lg bg-[#1f1f1f] p-3 text-xs text-[#ababab]">
            Lebih {quantityDisplay(-missing, item.unit)} dicatat sebagai selisih lebih (Penyesuaian), mengurangi
            kerugian; COGS per {item.unit || "porsi"} tetap:{" "}
            <strong className="text-green-400">+{currency(getWasteCost(item, -missing))}</strong>
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
            disabled={isSaving}
            className="rounded-lg bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PreparedStockDialog;
