import { useState } from "react";
import { enqueueSnackbar } from "notistack";
import { SUPPLY_CATEGORIES } from "../../utils/purchaseKinds";

const inputClass =
  "mt-2 w-full rounded-lg bg-[#262626] px-4 py-3 text-sm text-[#f5f5f5] outline-none focus:ring-1 focus:ring-[#a79981]";

// "Ubah" of a perlengkapan: name, category, unit, minimum, supplier and Bebas
// Stok. The stock itself changes through belanja or "Sesuaikan".
const SupplyItemDialog = ({ item, onSave, onCancel, isSaving }) => {
  const [form, setForm] = useState(() => ({
    name: item.name || "",
    category: item.category || SUPPLY_CATEGORIES[0],
    unit: item.unit || "",
    minimumStock: String(item.minimumStock ?? 0),
    supplier: item.supplier || "",
    isUnlimited: Boolean(item.isUnlimited),
  }));
  const setField = (field) => (event) =>
    setForm((current) => ({
      ...current,
      [field]: event.target.type === "checkbox" ? event.target.checked : event.target.value,
    }));

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isSaving) return;
    const name = form.name.trim().replace(/\s+/g, " ");
    const unit = form.unit.trim().toLowerCase();
    if (!name || !unit) {
      enqueueSnackbar("Nama dan satuan wajib diisi.", { variant: "warning" });
      return;
    }
    onSave({
      name,
      category: form.category,
      unit,
      minimumStock: Math.max(Number(String(form.minimumStock).replace(",", ".")) || 0, 0),
      supplier: form.supplier.trim(),
      isUnlimited: form.isUnlimited,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="supply-item-dialog-title"
    >
      <form onSubmit={handleSubmit} className="w-full max-w-xl rounded-lg bg-[#1f1f1f] p-5 text-[#f5f5f5] shadow-2xl">
        <h3 id="supply-item-dialog-title" className="text-lg font-bold">
          Ubah Perlengkapan
        </h3>
        <p className="mt-1 text-sm text-[#ababab]">
          Stok {item.stock} {item.unit}. Stok berubah lewat belanja atau Sesuaikan.
        </p>

        <fieldset disabled={isSaving} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold text-[#ababab]">
            Nama
            <input value={form.name} onChange={setField("name")} maxLength={150} className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-[#ababab]">
            Kategori
            <select value={form.category} onChange={setField("category")} className={inputClass}>
              {SUPPLY_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-[#ababab]">
            Satuan
            <input value={form.unit} onChange={setField("unit")} maxLength={30} className={inputClass} />
            <span className="mt-1 block text-xs font-normal text-[#888]">
              Ganti gr ↔ kg atau ml ↔ liter ikut mengonversi stok.
            </span>
          </label>
          <label className="text-sm font-semibold text-[#ababab]">
            Minimum
            <input
              value={form.minimumStock}
              onChange={setField("minimumStock")}
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
            />
          </label>
          <label className="text-sm font-semibold text-[#ababab] sm:col-span-2">
            Supplier
            <input value={form.supplier} onChange={setField("supplier")} maxLength={150} className={inputClass} />
          </label>
          <label className="flex items-center gap-3 rounded-lg bg-[#262626] px-4 py-3 text-sm font-semibold text-[#ababab] sm:col-span-2">
            <input
              checked={form.isUnlimited}
              onChange={setField("isUnlimited")}
              type="checkbox"
              className="h-4 w-4 accent-[#a79981]"
            />
            Bebas Stok (jasa atau biaya tanpa stok, mis. iklan, listrik)
          </label>
        </fieldset>

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

export default SupplyItemDialog;
