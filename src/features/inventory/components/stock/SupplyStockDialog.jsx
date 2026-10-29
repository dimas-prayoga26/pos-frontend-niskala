import { useState } from "react";
import { enqueueSnackbar } from "notistack";
import { currency } from "../../utils/format";

const inputClass =
  "mt-2 w-full rounded-lg bg-[#262626] px-4 py-3 text-sm text-[#f5f5f5] outline-none focus:ring-1 focus:ring-[#a79981]";

// "Sesuaikan": the counted stock of a perlengkapan (e.g. 3 tabung gas left).
// Its value follows at the current price per unit.
const SupplyStockDialog = ({ item, onSave, onCancel, isSaving }) => {
  const [stock, setStock] = useState(String(item.stock ?? 0));
  const count = Number(String(stock).replace(",", "."));
  const unitValue = item.stock > 0 ? item.stockValue / item.stock : item.averageCost;
  const valueAfter = Number.isFinite(count) && count >= 0 ? count * unitValue : 0;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isSaving) return;
    if (!Number.isFinite(count) || count < 0 || String(stock).trim() === "") {
      enqueueSnackbar("Isi jumlah stok yang valid.", { variant: "warning" });
      return;
    }
    onSave(Math.round(count * 100) / 100);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="supply-stock-dialog-title"
    >
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg bg-[#1f1f1f] p-5 text-[#f5f5f5] shadow-2xl">
        <h3 id="supply-stock-dialog-title" className="text-lg font-bold">
          Sesuaikan {item.name}
        </h3>
        <p className="mt-1 text-sm text-[#ababab]">
          Tercatat {item.stock} {item.unit}. Isi jumlah yang ada sekarang.
        </p>
        <label className="mt-4 block text-sm font-semibold text-[#ababab]">
          Stok Sekarang ({item.unit || "satuan"})
          <input
            value={stock}
            onChange={(event) => setStock(event.target.value)}
            type="number"
            min="0"
            step="0.01"
            disabled={isSaving}
            className={inputClass}
          />
        </label>
        <p className="mt-3 text-sm text-[#ababab]">
          Nilai setelah disesuaikan: <strong className="text-[#f5f5f5]">{currency(valueAfter)}</strong>
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5] disabled:opacity-60"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010] disabled:opacity-60"
          >
            {isSaving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SupplyStockDialog;
