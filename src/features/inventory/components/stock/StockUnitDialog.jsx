import { useState } from "react";
import { enqueueSnackbar } from "notistack";
import { costDisplay, currency, quantityDisplay } from "../../utils/format";
import { parseShoppingQuantity } from "../../utils/shopping";
import { knownUnitFactor } from "../../utils/units";

const inputClass =
  "mt-2 w-full rounded-lg bg-[#262626] px-4 py-3 text-sm text-[#f5f5f5] outline-none focus:ring-1 focus:ring-[#a79981]";
const UNIT_SUGGESTIONS = ["gr", "ml", "pcs", "kg", "liter"];

// Konversi Satuan of a bahan baku, e.g. Air Isi Ulang from galon to ml so its
// belanja are filled in gramasi: 1 galon = 19000 ml. The server converts the
// stok, minimum, COGS, recipes and purchase lines; the value stays the same.
// Units it converts itself (kg and gr, liter and ml) need no isi.
const StockUnitDialog = ({ item, onSave, onCancel, isSaving }) => {
  const [unit, setUnit] = useState("");
  const [factor, setFactor] = useState("");
  const from = String(item.unit || "").trim().toLowerCase();
  const to = unit.trim().toLowerCase();
  const knownFactor = to ? knownUnitFactor(from, to) : null;
  const ratio = knownFactor ?? parseShoppingQuantity(factor);
  const isReady = Boolean(to) && to !== from && Number.isFinite(ratio) && ratio > 0;
  const newStock = isReady ? Math.round(Number(item.stock || 0) * ratio * 100) / 100 : 0;
  const newCost = isReady
    ? Math.round(newStock > 0 && item.stockValue > 0 ? item.stockValue / newStock : Number(item.averageCost || 0) / ratio)
    : 0;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isSaving) return;
    if (!to) {
      enqueueSnackbar("Isi satuan barunya, mis. ml.", { variant: "warning" });
      return;
    }
    if (to === from) {
      enqueueSnackbar(`Satuan ${item.name} sudah ${from}.`, { variant: "warning" });
      return;
    }
    if (!isReady) {
      enqueueSnackbar(`Isi konversinya: 1 ${from} = berapa ${to}?`, { variant: "warning" });
      return;
    }
    onSave({ unit: to, factor: ratio });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-unit-dialog-title"
    >
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-lg bg-[#1f1f1f] p-4 text-[#f5f5f5] shadow-2xl">
        <div className="mb-4 border-b border-[#333] pb-4">
          <h3 id="stock-unit-dialog-title" className="text-lg font-bold">
            Konversi Satuan {item.name}
          </h3>
          <p className="mt-1 text-sm text-[#ababab]">
            Satuan sekarang: <span className="font-semibold text-[#f5f5f5]">{from || "-"}</span>. Stok, minimum, COGS,
            resep, dan riwayat belanja ikut dikonversi; nilai asetnya tetap.
          </p>
        </div>

        <fieldset disabled={isSaving} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold text-[#ababab]">
            Satuan Baru
            <input
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              list="stock-unit-convert-suggestions"
              maxLength={30}
              placeholder="ml"
              className={inputClass}
            />
            <datalist id="stock-unit-convert-suggestions">
              {UNIT_SUGGESTIONS.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
          </label>
          <label className="text-sm font-semibold text-[#ababab]">
            1 {from || "satuan lama"} = berapa {to || "satuan baru"}?
            <input
              value={knownFactor == null ? factor : String(knownFactor)}
              onChange={(event) => setFactor(event.target.value)}
              disabled={knownFactor != null}
              type="text"
              inputMode="decimal"
              placeholder="mis. 19000"
              aria-label="Isi per satuan lama"
              className={`${inputClass} disabled:opacity-60`}
            />
            {knownFactor != null && (
              <span className="mt-1 block text-xs font-normal text-[#888]">Dihitung otomatis.</span>
            )}
          </label>
        </fieldset>

        {isReady && (
          <dl className="mt-4 space-y-1 rounded-lg bg-[#262626] p-3 text-sm" aria-label="Hasil konversi">
            <div className="flex justify-between gap-3">
              <dt className="text-[#ababab]">Stok</dt>
              <dd>
                {quantityDisplay(item.stock, from)} → <strong>{quantityDisplay(newStock, to)}</strong>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#ababab]">COGS</dt>
              <dd>
                {costDisplay(item.averageCost, from)} → <strong>{costDisplay(newCost, to)}</strong>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#ababab]">Nilai Asset</dt>
              <dd>{currency(item.stockValue)} (tetap)</dd>
            </div>
          </dl>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Menyimpan..." : "Konversi"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5] disabled:opacity-60"
          >
            Batal
          </button>
        </div>
      </form>
    </div>
  );
};

export default StockUnitDialog;
