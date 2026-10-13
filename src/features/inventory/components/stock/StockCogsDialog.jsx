import { useState } from "react";
import { enqueueSnackbar } from "notistack";
import { currency, displayCostUnit, formatRupiahInput } from "../../utils/format";
import {
  getAssetValueFromPackage,
  getPackageCostValue,
  getStockQuantity,
  parseCostInput,
} from "../../utils/stockItems";

const inputClass =
  "w-full rounded-lg border border-[#555] bg-[#1f1f1f] px-3 py-2 text-[#f5f5f5] outline-none focus:border-[#d6c7ae]";
const readOnlyClass =
  "w-full rounded-lg border border-[#444] bg-[#1f1f1f] px-3 py-2 font-semibold text-[#f5f5f5]";

// Sets the opening COGS from a package (e.g. 800 ml for Rp 169.000). The form
// starts from the current stock and stock value.
const StockCogsDialog = ({ item, onSave, onCancel, isSaving }) => {
  const [form, setForm] = useState(() => ({
    packageQuantity: String(getStockQuantity(item) || ""),
    packagePrice: String(Number(item.stockValue || 0)),
    supplier: item.supplier || "",
  }));
  const costUnit = displayCostUnit(item.unit);
  const costValue = getPackageCostValue(form);
  const assetValue = getAssetValueFromPackage(item, form);
  const setField = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = (event) => {
    event.preventDefault();

    const packageQuantity = parseCostInput(form.packageQuantity);
    const packagePrice = Number(form.packagePrice || 0);
    if (!Number.isFinite(packageQuantity) || packageQuantity <= 0) {
      enqueueSnackbar("Gramasi kemasan tidak valid.", { variant: "error" });
      return;
    }
    if (!Number.isFinite(packagePrice) || packagePrice < 0) {
      enqueueSnackbar("Harga kemasan tidak valid.", { variant: "error" });
      return;
    }

    onSave({ averageCost: costValue, supplier: form.supplier });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={handleSubmit}
        className="rounded-lg bg-[#262626] p-5 text-[#f5f5f5] shadow-2xl"
        style={{ width: "min(92vw, 460px)" }}
      >
        <div className="mb-4 border-b border-[#333] pb-3">
          <h3 className="text-lg font-bold">Ubah COGS Awal</h3>
          <p className="mt-1 text-sm text-[#ababab]">
            {item.name} · stok {item.stock} {item.unit}
          </p>
        </div>

        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-sm font-semibold">Gramasi Kemasan</span>
            <input
              type="text"
              inputMode="decimal"
              value={form.packageQuantity}
              onChange={setField("packageQuantity")}
              className={inputClass}
              placeholder={`Contoh: 800 ${costUnit}`}
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-semibold">Harga Kemasan</span>
            <input
              type="text"
              inputMode="numeric"
              value={formatRupiahInput(form.packagePrice)}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  packagePrice: event.target.value.replace(/\D/g, ""),
                }))
              }
              className={inputClass}
              placeholder="Contoh: 169000"
            />
          </label>
        </div>

        <div className="mb-3 block">
          <span className="mb-1 block text-sm font-semibold">COGS Otomatis</span>
          <div className={readOnlyClass}>
            {currency(costValue)} / {costUnit}
          </div>
          <span className="mt-1 block text-xs text-[#ababab]">
            Hasil dari harga kemasan dibagi gramasi kemasan.
          </span>
        </div>

        <div className="mb-3 block">
          <span className="mb-1 block text-sm font-semibold">Nilai Asset Otomatis</span>
          <div className={readOnlyClass}>{currency(assetValue)}</div>
          <span className="mt-1 block text-xs text-[#ababab]">
            Hasil dari COGS otomatis dikali stok sekarang.
          </span>
        </div>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-semibold">Sumber / catatan</span>
          <input
            type="text"
            value={form.supplier}
            onChange={setField("supplier")}
            className={inputClass}
            placeholder="Contoh: Setup COGS Awal"
          />
        </label>

        <div className="mb-5 rounded-lg bg-[#1f1f1f] p-3 text-sm">
          <span className="block text-[#ababab]">Ringkasan Setelah Ubah</span>
          <strong className="mt-1 block text-base">
            {currency(assetValue)} - {currency(costValue)} / {costUnit}
          </strong>
        </div>

        <div className="flex justify-end gap-3">
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

export default StockCogsDialog;
