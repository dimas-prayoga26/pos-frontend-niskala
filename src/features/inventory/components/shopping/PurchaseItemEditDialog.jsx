import CreatableSelect2 from "../../../../shared/ui/CreatableSelect2";
import { formatRupiahInput } from "../../utils/format";
import { unitOptionsFor } from "../../utils/shopping";
import { buttonClass, inputClass } from "./styles";

// showUnits false (barang Lainnya): no unit; the line keeps its own. A bahan
// baku line bought by the package before (hasPack, e.g. from the rekap import)
// also shows its Isi per Kemasan, in the stock unit (packUnit); new lines have
// none, their gramasi is in the stock unit.
const PurchaseItemEditDialog = ({
  itemName,
  form,
  onChange,
  onSubmit,
  onClose,
  isSaving,
  showUnits = true,
  hasPack = false,
  packUnit = "",
}) => (
  <div
    className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-3"
    role="dialog"
    aria-modal="true"
    aria-labelledby="shopping-item-edit-title"
  >
    <form
      onSubmit={onSubmit}
      className="w-full max-w-xl rounded-xl bg-[#1f1f1f] p-5 text-[#f5f5f5] shadow-xl"
    >
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#333] pb-4">
        <div>
          <h2 id="shopping-item-edit-title" className="text-xl font-bold">
            Edit Belanja {itemName}
          </h2>
          <p className="mt-1 text-sm text-[#ababab]">Perubahan akan tercatat di log aktivitas.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold">
          Tutup
        </button>
      </div>
      <div className={`grid gap-3 ${showUnits ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        <label>
          <span className="mb-1 block text-sm">{showUnits ? "Gramasi" : "Qty"}</span>
          <input
            value={form.quantity}
            onChange={(event) => onChange({ quantity: event.target.value })}
            type="text"
            inputMode="decimal"
            className={inputClass}
          />
        </label>
        {showUnits && (
          <div>
            <span className="mb-1 block text-sm">Satuan</span>
            <CreatableSelect2
              options={unitOptionsFor(packUnit, form.unit)}
              value={form.unit}
              onSelect={(option) => onChange({ unit: option?.id || "" })}
              placeholder="Pilih satuan"
              label="Satuan"
              disabled={isSaving}
            />
          </div>
        )}
        {showUnits && hasPack && (
          <label>
            <span className="mb-1 block text-sm">Isi per Kemasan{packUnit ? ` (${packUnit})` : ""}</span>
            <input
              value={form.packSize ?? ""}
              onChange={(event) => onChange({ packSize: event.target.value })}
              type="text"
              inputMode="decimal"
              placeholder="kosong jika tanpa kemasan"
              aria-label="Isi per Kemasan"
              className={inputClass}
            />
          </label>
        )}
        <label>
          <span className="mb-1 block text-sm">Harga Total</span>
          <input
            value={formatRupiahInput(form.unitPrice)}
            onChange={(event) => onChange({ unitPrice: event.target.value.replace(/\D/g, "") })}
            type="text"
            inputMode="numeric"
            className={inputClass}
          />
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="px-4 py-2">
          Batal
        </button>
        <button type="submit" disabled={isSaving} className={buttonClass}>
          {isSaving ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </form>
  </div>
);

export default PurchaseItemEditDialog;
