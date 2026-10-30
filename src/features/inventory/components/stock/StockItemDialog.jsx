import { useState } from "react";
import { enqueueSnackbar } from "notistack";

const inputClass =
  "mt-2 w-full rounded-lg bg-[#262626] px-4 py-3 text-sm text-[#f5f5f5] outline-none focus:ring-1 focus:ring-[#a79981]";
const UNIT_SUGGESTIONS = ["gr", "ml", "pcs", "kg", "liter"];

const emptyForm = {
  name: "",
  category: "",
  unit: "",
  stock: "0",
  minimumStock: "0",
  supplier: "",
  isUnlimited: false,
  isRecipeIngredient: true,
};

// "Tambah Stok": a new bahan baku (stock_raw_items). Its cost comes from
// belanja, so the stock usually starts at 0 and is received through
// the Belanja menu.
const StockItemDialog = ({ onSave, onCancel, isSaving }) => {
  const [form, setForm] = useState(emptyForm);
  const setField = (field) => (event) =>
    setForm((current) => ({
      ...current,
      [field]: event.target.type === "checkbox" ? event.target.checked : event.target.value,
    }));

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isSaving) return;

    const name = form.name.trim().replace(/\s+/g, " ");
    const category = form.category.trim();
    const unit = form.unit.trim().toLowerCase();
    if (!name || !category || !unit) {
      enqueueSnackbar("Bahan, kategori, dan satuan wajib diisi.", { variant: "warning" });
      return;
    }

    onSave({
      name,
      category,
      unit,
      stock: Math.max(Number(String(form.stock).replace(",", ".")) || 0, 0),
      minimumStock: Math.max(Number(String(form.minimumStock).replace(",", ".")) || 0, 0),
      supplier: form.supplier.trim(),
      isUnlimited: form.isUnlimited,
      isRecipeIngredient: form.isRecipeIngredient,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-item-dialog-title"
    >
      <form
        onSubmit={handleSubmit}
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-[#1f1f1f] p-4 pb-0 text-[#f5f5f5] shadow-2xl"
      >
        <div className="mb-4 flex flex-col gap-2 border-b border-[#333] pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 id="stock-item-dialog-title" className="text-lg font-bold">
              Tambah Stok
            </h3>
            <p className="mt-1 text-sm text-[#ababab]">
              Isi data bahan, satuan, stok, minimum, dan supplier.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-fit rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5]"
          >
            Tutup
          </button>
        </div>

        <fieldset disabled={isSaving} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold text-[#ababab]">
            Bahan
            <input
              value={form.name}
              onChange={setField("name")}
              maxLength={150}
              placeholder="Sirup vanila"
              className={inputClass}
            />
          </label>
          <label className="text-sm font-semibold text-[#ababab]">
            Kategori
            <input
              value={form.category}
              onChange={setField("category")}
              maxLength={100}
              placeholder="Kopi"
              className={inputClass}
            />
          </label>
          <label className="text-sm font-semibold text-[#ababab]">
            Satuan
            <input
              value={form.unit}
              onChange={setField("unit")}
              list="stock-unit-suggestions"
              maxLength={30}
              placeholder="gr"
              className={inputClass}
            />
            <datalist id="stock-unit-suggestions">
              {UNIT_SUGGESTIONS.map((unit) => (
                <option key={unit} value={unit} />
              ))}
            </datalist>
          </label>
          <label className="text-sm font-semibold text-[#ababab]">
            Stok
            <input
              value={form.stock}
              onChange={setField("stock")}
              type="number"
              min="0"
              step="0.01"
              disabled={form.isUnlimited}
              className={`${inputClass} disabled:opacity-50`}
            />
            <span className="mt-1 block text-xs font-normal text-[#888]">
              Biarkan 0 lalu masukkan stok lewat menu Belanja agar COGS ikut terhitung.
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
              disabled={form.isUnlimited}
              className={`${inputClass} disabled:opacity-50`}
            />
          </label>
          <label className="text-sm font-semibold text-[#ababab]">
            Supplier
            <input
              value={form.supplier}
              onChange={setField("supplier")}
              maxLength={150}
              placeholder="Toko bahan"
              className={inputClass}
            />
          </label>
          <label className="flex items-center gap-3 rounded-lg bg-[#262626] px-4 py-3 text-sm font-semibold text-[#ababab] sm:col-span-2">
            <input
              checked={form.isUnlimited}
              onChange={setField("isUnlimited")}
              type="checkbox"
              className="h-4 w-4 accent-[#a79981]"
            />
            Bebas Stok, tidak berkurang otomatis saat ada pesanan
          </label>
          <label className="flex items-center gap-3 rounded-lg bg-[#262626] px-4 py-3 text-sm font-semibold text-[#ababab] sm:col-span-2">
            <input
              checked={form.isRecipeIngredient}
              onChange={setField("isRecipeIngredient")}
              type="checkbox"
              className="h-4 w-4 accent-[#a79981]"
            />
            Bahan Resep, muncul di pilihan resep menu dan bahan setengah jadi
          </label>
        </fieldset>

        <div className="sticky bottom-0 -mx-4 mt-5 flex gap-2 border-t border-[#333] bg-[#1f1f1f] px-4 py-4">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Menyimpan..." : "Tambah Stok"}
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

export default StockItemDialog;
