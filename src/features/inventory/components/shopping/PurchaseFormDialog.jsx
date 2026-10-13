import { FiTrash2 } from "react-icons/fi";
import CreatableSelect2 from "../../../../shared/ui/CreatableSelect2";
import { currency, formatRupiahInput } from "../../utils/format";
import { PAYMENT_OPTIONS, UNIT_OPTIONS, lineTotal, purchaseUnitForStockUnit } from "../../utils/shopping";
import { buttonClass, inputClass } from "./styles";

const MAX_ROWS = 100;

// "Tambah Bahan Belanjaan" form. All state comes from usePurchaseForm.
const PurchaseFormDialog = ({ purchaseForm, onClose }) => {
  const {
    form,
    setForm,
    rows,
    updateRow,
    addRow,
    removeRow,
    saving,
    supplierOptions,
    itemOptions,
    createSupplier,
    createItem,
    submit,
  } = purchaseForm;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shopping-form-title"
    >
      <form
        onSubmit={submit}
        className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-[#1f1f1f] p-5 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="shopping-form-title" className="text-xl font-bold">
              Tambah Bahan Belanjaan
            </h2>
            <p className="mt-1 text-sm text-[#ababab]">
              Pilih &quot;Buat&quot; jika nama belum tersedia. Toko dan barang baru tersimpan saat
              klik Simpan Belanjaan.
            </p>
          </div>
          <button type="button" disabled={saving} onClick={onClose} aria-label="Tutup form" className="p-2">
            x
          </button>
        </div>
        <fieldset disabled={saving} className="min-w-0">
          <div className="grid gap-4 md:grid-cols-3">
            <label>
              <span className="mb-1 block text-sm">Tanggal</span>
              <input
                required
                type="date"
                className={inputClass}
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
            </label>
            <div>
              <span className="mb-1 block text-sm">Toko / Sumber</span>
              <CreatableSelect2
                options={supplierOptions}
                value={form.suplierId}
                onSelect={(option) =>
                  setForm((current) => ({ ...current, suplierId: option?.id || "" }))
                }
                onCreate={createSupplier}
                placeholder="Cari atau buat toko/sumber"
                disabled={saving}
              />
            </div>
            <div>
              <span className="mb-1 block text-sm">Pembayaran</span>
              <CreatableSelect2
                options={PAYMENT_OPTIONS}
                value={form.paymentMethod}
                onSelect={(option) =>
                  setForm((current) => ({ ...current, paymentMethod: option?.id || "Cash" }))
                }
                placeholder="Pilih pembayaran"
                label="Pembayaran"
                disabled={saving}
              />
            </div>
          </div>
          <div className="my-5 space-y-3">
            {rows.map((row, index) => {
              const selectedItem = itemOptions.find(
                (item) => String(item.id) === String(row.stockItemId)
              );

              return (
                <div key={row.key} className="rounded-lg border border-[#444] p-3">
                  <div className="mb-3 flex items-center justify-between gap-3 text-sm text-[#ababab]">
                    <span>Barang {index + 1}</span>
                    <button
                      type="button"
                      disabled={rows.length === 1}
                      aria-label={`Hapus barang ${index + 1}`}
                      title={rows.length === 1 ? "Minimal satu barang dalam belanja" : "Hapus barang ini"}
                      onClick={() => removeRow(row.key)}
                      className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-300 transition-colors hover:border-red-400/60 hover:bg-red-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:border-[#444] disabled:bg-[#262626] disabled:text-[#777]"
                    >
                      <FiTrash2 size={15} aria-hidden="true" />
                      Hapus
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,2fr)_minmax(80px,.6fr)_minmax(90px,.7fr)_minmax(120px,1fr)_minmax(120px,1fr)]">
                    <div>
                      <span className="mb-1 block text-sm">Nama Barang</span>
                      <CreatableSelect2
                        options={itemOptions}
                        value={row.stockItemId}
                        onSelect={(option) =>
                          updateRow(row.key, {
                            stockItemId: option?.id || "",
                            unit: purchaseUnitForStockUnit(option?.unit),
                          })
                        }
                        onCreate={createItem}
                        placeholder="Cari atau buat barang"
                        disabled={saving}
                      />
                    </div>
                    <label>
                      <span className="mb-1 block text-sm">Gramasi</span>
                      <input
                        required
                        type="text"
                        inputMode="decimal"
                        value={row.quantity}
                        onChange={(event) => updateRow(row.key, { quantity: event.target.value })}
                        className={inputClass}
                      />
                    </label>
                    <div>
                      <span className="mb-1 block text-sm">Satuan</span>
                      <CreatableSelect2
                        options={UNIT_OPTIONS}
                        value={row.unit}
                        onSelect={(option) => updateRow(row.key, { unit: option?.id || "" })}
                        placeholder="Pilih satuan"
                        label="Satuan"
                        disabled={saving}
                      />
                    </div>
                    <label>
                      <span className="mb-1 block text-sm">Harga Total</span>
                      <input
                        required
                        type="text"
                        inputMode="numeric"
                        value={formatRupiahInput(row.unitPrice)}
                        onChange={(event) =>
                          updateRow(row.key, { unitPrice: event.target.value.replace(/\D/g, "") })
                        }
                        className={inputClass}
                      />
                    </label>
                    <div>
                      <span className="mb-1 block text-sm">Jumlah</span>
                      <p className="py-2 font-bold">{currency(lineTotal(row))}</p>
                    </div>
                  </div>
                  {selectedItem?.unit && (
                    <p className="mt-2 text-xs text-[#ababab]">
                      Satuan stok: {selectedItem.unit}. Isi gramasi sesuai satuan stok; COGS dihitung
                      otomatis dari harga total. otomatis.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            disabled={rows.length >= MAX_ROWS}
            onClick={addRow}
            className="mb-4 rounded-lg border border-[#a79981] px-4 py-2 text-sm text-[#d6c7ae]"
          >
            + Tambah Barang
          </button>
          <label className="block">
            <span className="mb-1 block text-sm">Catatan (opsional)</span>
            <textarea
              className={inputClass}
              maxLength={500}
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
            />
          </label>
        </fieldset>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <strong>Total: {currency(rows.reduce((sum, row) => sum + lineTotal(row), 0))}</strong>
          <div className="flex gap-3">
            <button type="button" disabled={saving} onClick={onClose} className="px-4 py-2">
              Tutup
            </button>
            <button type="submit" disabled={saving} className={buttonClass}>
              {saving ? "Menyimpan..." : "Simpan Belanjaan"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default PurchaseFormDialog;
