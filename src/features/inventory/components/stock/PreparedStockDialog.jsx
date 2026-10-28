import { useState } from "react";
import { enqueueSnackbar } from "notistack";
import { parseCostInput } from "../../utils/stockItems";

const inputClass =
  "w-full rounded-lg border border-[#555] bg-[#1f1f1f] px-3 py-2 text-[#f5f5f5] outline-none focus:border-[#d6c7ae]";

// Sets the portions actually left (leftovers thrown away, a recount). The
// asset value scales with the stock.
const PreparedStockDialog = ({ item, onSave, onCancel, isSaving }) => {
  const [stock, setStock] = useState(String(Math.max(Number(item.stock || 0), 0)));

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
          Isi sisa yang benar-benar ada, misalnya setelah sisa dibuang di akhir hari.
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
