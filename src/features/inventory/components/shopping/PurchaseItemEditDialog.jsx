import CreatableSelect2 from "../../../../shared/ui/CreatableSelect2";
import { formatRupiahInput, quantityDisplay } from "../../utils/format";
import { editUnitOptionsFor, parseShoppingQuantity } from "../../utils/shopping";
import { convertQuantity, isSameUnit, measuredBaseUnit, needsIsi, switchesStockUnit } from "../../utils/units";
import { buttonClass, inputClass } from "./styles";

const pricePerUnit = (total, quantity) =>
  `Rp ${(total / quantity).toLocaleString("id-ID", { maximumFractionDigits: 2 })}`;

// Like the purchase form: the gramasi and the harga total of a line. showUnits
// false (barang Lainnya): a qty, no unit. A unit the stock unit cannot come
// from (pcs of a bahan in ml, a dus) asks its isi too: 10 pcs × 1.000 ml.
// "Masuk stok" shows what the line puts into stock, and what it was, so a
// wrong gramasi or isi is seen before saving. gr or ml for a bahan counted in
// pcs moves its satuan stok there, 1 pcs = what this line weighs. With
// merkOptions the line's merk can be changed or created too.
const PurchaseItemEditDialog = ({
  itemName,
  form,
  onChange,
  onSubmit,
  onClose,
  isSaving,
  showUnits = true,
  stockUnit = "",
  previousStockQuantity,
  merkOptions,
  onCreateMerk,
}) => {
  const quantity = parseShoppingQuantity(form.quantity);
  const switching = showUnits && switchesStockUnit(form.unit, stockUnit);
  const resultUnit = switching ? measuredBaseUnit(form.unit) : stockUnit || form.unit;
  const withIsi = showUnits && needsIsi(form.unit, stockUnit);
  const isi = withIsi ? parseShoppingQuantity(form.packSize) : NaN;
  const stockQuantity = !(quantity > 0)
    ? null
    : withIsi
      ? isi > 0
        ? quantity * isi
        : null
      : convertQuantity(quantity, form.unit, resultUnit);
  const total = Number(form.unitPrice || 0);
  const hasChanged =
    stockQuantity != null &&
    previousStockQuantity != null &&
    (switching || Math.abs(stockQuantity - previousStockQuantity) >= 0.005);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shopping-item-edit-title"
    >
      <form onSubmit={onSubmit} className="w-full max-w-xl rounded-xl bg-[#1f1f1f] p-5 text-[#f5f5f5] shadow-xl">
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
        {merkOptions && (
          <div className="mb-3">
            <span className="mb-1 block text-sm">Merk (opsional)</span>
            <CreatableSelect2
              options={merkOptions}
              value={form.merkId}
              onSelect={(option) => onChange({ merkId: option?.id || "" })}
              onCreate={onCreateMerk}
              placeholder="Cari atau buat merk"
              label="Merk"
              disabled={isSaving}
            />
          </div>
        )}
        <div className={`grid gap-3 ${showUnits && !withIsi ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          <label>
            <span className="mb-1 block text-sm">{!showUnits ? "Qty" : withIsi ? "Jumlah" : "Gramasi"}</span>
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
                options={editUnitOptionsFor(stockUnit, form.unit)}
                value={form.unit}
                onSelect={(option) => onChange({ unit: option?.id || "" })}
                placeholder="Pilih satuan"
                label="Satuan"
                disabled={isSaving}
              />
            </div>
          )}
          {withIsi && (
            <label>
              <span className="mb-1 block text-sm">
                Isi 1 {form.unit} ({stockUnit})
              </span>
              <input
                value={form.packSize ?? ""}
                onChange={(event) => onChange({ packSize: event.target.value })}
                type="text"
                inputMode="decimal"
                placeholder="Contoh: 1000"
                aria-label="Isi per satuan"
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

        {showUnits && (
          <div aria-label="Masuk stok" className="mt-4 rounded-lg bg-[#262626] p-3 text-sm">
            {stockQuantity == null ? (
              <p className="text-yellow-200">
                {!(quantity > 0) ? `Isi ${withIsi ? "jumlahnya" : "gramasinya"}.` : `Isi 1 ${form.unit} berapa ${resultUnit}?`}
              </p>
            ) : (
              <>
                <div className="flex justify-between gap-3">
                  <span className="text-[#ababab]">Masuk stok</span>
                  <strong className="text-right">
                    {withIsi
                      ? `${quantityDisplay(quantity, form.unit)} × ${quantityDisplay(isi, resultUnit)} = `
                      : !isSameUnit(form.unit, resultUnit) && `${quantityDisplay(quantity, form.unit)} = `}
                    {quantityDisplay(stockQuantity, resultUnit)}
                  </strong>
                </div>
                {hasChanged && (
                  <p className="text-right text-xs text-[#ababab]">
                    Sebelumnya {quantityDisplay(previousStockQuantity, stockUnit || resultUnit)}
                  </p>
                )}
                {switching && (
                  <div className="mt-1 flex justify-between gap-3">
                    <span className="text-[#ababab]">Satuan stok</span>
                    <strong className="text-right">
                      {stockUnit} → {resultUnit}
                      {previousStockQuantity > 0 && (
                        <span className="block text-xs font-normal text-[#ababab]">
                          1 {stockUnit} = {quantityDisplay(stockQuantity / previousStockQuantity, resultUnit)}
                        </span>
                      )}
                    </strong>
                  </div>
                )}
                {total > 0 && stockQuantity > 0 && (
                  <div className="mt-1 flex justify-between gap-3">
                    <span className="text-[#ababab]">Harga per {resultUnit}</span>
                    <strong>{pricePerUnit(total, stockQuantity)}</strong>
                  </div>
                )}
              </>
            )}
          </div>
        )}

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
};

export default PurchaseItemEditDialog;
