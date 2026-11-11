import { useMemo, useState } from "react";
import { enqueueSnackbar } from "notistack";
import CreatableSelect2 from "../../../../shared/ui/CreatableSelect2";
import { UNIT_OPTIONS } from "../../utils/shopping";
import { parseCostInput } from "../../utils/stockItems";

const inputClass =
  "w-full rounded-lg border border-[#555] bg-[#1f1f1f] px-3 py-2 text-[#f5f5f5] outline-none focus:border-[#d6c7ae]";
const toggleClass = (active) =>
  `flex-1 rounded-md px-3 py-2 text-sm font-bold transition ${
    active ? "bg-[#a79981] text-[#101010]" : "text-[#ababab] hover:bg-[#333] hover:text-white"
  }`;

const toOptions = (names) => names.map((name) => ({ id: name, text: name }));
const uniqueSorted = (names) =>
  [...new Set(names.map((name) => String(name || "").trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "id")
  );

// Tambah Bahan on Bahan Baku: only the bahan itself (stok 0, COGS from its
// first Belanja). The name of a hidden bahan brings that bahan back.
// recipeOnly (made for a bahan olahan): always a Bahan Resep.
const AddStockItemDialog = ({ stockItems, initialName = "", recipeOnly = false, onSave, onCancel, isSaving }) => {
  const [form, setForm] = useState({
    name: initialName,
    category: "",
    unit: "gr",
    minimumStock: "",
    isRecipeIngredient: true,
  });
  // Kategori and satuan typed in the select, kept so the select can show them.
  const [extraCategories, setExtraCategories] = useState([]);
  const [extraUnits, setExtraUnits] = useState([]);
  const categoryOptions = useMemo(
    () => toOptions(uniqueSorted([...stockItems.map((item) => item.category), ...extraCategories])),
    [stockItems, extraCategories]
  );
  const unitOptions = useMemo(
    () => [...UNIT_OPTIONS, ...toOptions(extraUnits)],
    [extraUnits]
  );
  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const createOption = (setExtra) => async (text) => {
    setExtra((current) => [...current, text]);
    return { id: text, text };
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const name = form.name.trim().replace(/\s+/g, " ");
    const minimumStock = form.minimumStock.trim() === "" ? 0 : parseCostInput(form.minimumStock);
    if (!name) {
      enqueueSnackbar("Nama bahan wajib diisi.", { variant: "error" });
      return;
    }
    if (!form.category) {
      enqueueSnackbar("Kategori wajib dipilih.", { variant: "error" });
      return;
    }
    if (!form.unit) {
      enqueueSnackbar("Satuan wajib dipilih.", { variant: "error" });
      return;
    }
    if (!Number.isFinite(minimumStock) || minimumStock < 0) {
      enqueueSnackbar("Minimum stok tidak valid.", { variant: "error" });
      return;
    }

    onSave({
      name,
      category: form.category,
      unit: form.unit,
      stock: 0,
      minimumStock,
      isRecipeIngredient: recipeOnly || form.isRecipeIngredient,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={handleSubmit}
        aria-label="Form tambah bahan"
        className="rounded-lg bg-[#262626] p-5 text-[#f5f5f5] shadow-2xl"
        style={{ width: "min(92vw, 460px)" }}
      >
        <div className="mb-4 border-b border-[#333] pb-3">
          <h3 className="text-lg font-bold">Tambah Bahan</h3>
          <p className="mt-1 text-sm text-[#ababab]">Stok awal 0, diisi lewat Belanja.</p>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-semibold">Nama Bahan</span>
          <input
            type="text"
            value={form.name}
            onChange={(event) => setField("name", event.target.value)}
            maxLength={150}
            className={inputClass}
            placeholder="Contoh: Cabe Rawit"
            autoFocus
          />
        </label>

        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <div>
            <span className="mb-1 block text-sm font-semibold">Kategori</span>
            <CreatableSelect2
              options={categoryOptions}
              value={form.category}
              onSelect={(option) => setField("category", option?.id || "")}
              onCreate={createOption(setExtraCategories)}
              placeholder="Pilih kategori"
              label="Kategori"
              disabled={isSaving}
            />
          </div>
          <div>
            <span className="mb-1 block text-sm font-semibold">Satuan</span>
            <CreatableSelect2
              options={unitOptions}
              value={form.unit}
              onSelect={(option) => setField("unit", option?.id || "")}
              onCreate={createOption(setExtraUnits)}
              placeholder="Pilih satuan"
              label="Satuan"
              disabled={isSaving}
            />
          </div>
        </div>

        <label className={`${recipeOnly ? "mb-5" : "mb-3"} block`}>
          <span className="mb-1 block text-sm font-semibold">Minimum Stok</span>
          <input
            type="text"
            inputMode="decimal"
            value={form.minimumStock}
            onChange={(event) => setField("minimumStock", event.target.value)}
            className={inputClass}
            placeholder={`0 ${form.unit}`}
          />
        </label>

        {!recipeOnly && (
          <div className="mb-5">
            <span className="mb-1 block text-sm font-semibold">Bahan Resep</span>
            <div className="flex gap-2 rounded-lg bg-[#1f1f1f] p-1" role="group" aria-label="Bahan Resep">
              {[true, false].map((value) => (
                <button
                  key={String(value)}
                  type="button"
                  aria-pressed={form.isRecipeIngredient === value}
                  onClick={() => setField("isRecipeIngredient", value)}
                  className={toggleClass(form.isRecipeIngredient === value)}
                >
                  {value ? "Ya" : "Tidak"}
                </button>
              ))}
            </div>
          </div>
        )}

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

export default AddStockItemDialog;
