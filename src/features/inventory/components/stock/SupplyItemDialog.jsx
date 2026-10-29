import { useState } from "react";
import { enqueueSnackbar } from "notistack";
import { SUPPLY_CATEGORIES } from "../../utils/purchaseKinds";

const inputClass =
  "mt-2 w-full rounded-lg bg-[#262626] px-4 py-3 text-sm text-[#f5f5f5] outline-none focus:ring-1 focus:ring-[#a79981]";

// "Ubah" of a barang Lainnya: name, category and supplier. It has no unit (the
// server keeps the one it has), no minimum and no Bebas Stok: these are not
// bahan to restock, sending neither leaves both off. The qty itself changes
// through belanja or "Sesuaikan".
const SupplyItemDialog = ({ item, onSave, onCancel, isSaving }) => {
  const [form, setForm] = useState(() => ({
    name: item.name || "",
    category: SUPPLY_CATEGORIES.includes(item.category) ? item.category : SUPPLY_CATEGORIES[0],
    supplier: item.supplier || "",
  }));
  const setField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isSaving) return;
    const name = form.name.trim().replace(/\s+/g, " ");
    if (!name) {
      enqueueSnackbar("Nama wajib diisi.", { variant: "warning" });
      return;
    }
    onSave({
      name,
      category: form.category,
      supplier: form.supplier.trim(),
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
          Ubah Barang Lainnya
        </h3>
        <p className="mt-1 text-sm text-[#ababab]">
          Qty {item.stock}. Qty berubah lewat belanja atau Sesuaikan.
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
          <label className="text-sm font-semibold text-[#ababab] sm:col-span-2">
            Supplier
            <input value={form.supplier} onChange={setField("supplier")} maxLength={150} className={inputClass} />
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
