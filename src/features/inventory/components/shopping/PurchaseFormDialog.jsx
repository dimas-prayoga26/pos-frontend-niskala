import { FiTrash2 } from "react-icons/fi";
import CreatableSelect2 from "../../../../shared/ui/CreatableSelect2";
import { currency, formatRupiahInput, signedCurrency } from "../../utils/format";
import { PURCHASE_KIND_LIST, SUPPLY_CATEGORY_OPTIONS } from "../../utils/purchaseKinds";
import { MAX_RECEIPTS_PER_UPLOAD } from "../../utils/receiptImages";
import { UNIT_OPTIONS, lineTotal, purchaseUnitForStockUnit } from "../../utils/shopping";
import NotaSummary from "./NotaSummary";
import ReceiptPicker from "./ReceiptPicker";
import { buttonClass, inputClass } from "./styles";

const MAX_ROWS = 100;
const kindButtonClass = (active) =>
  `rounded-md px-4 py-2 text-sm font-bold transition-colors ${
    active ? "bg-[#a79981] text-[#101010]" : "text-[#ababab] hover:bg-[#333] hover:text-white"
  }`;

// "Tambah Belanja" form for every belanja: Jenis Belanja picks bahan
// baku or perlengkapan. All state comes from usePurchaseForm.
const PurchaseFormDialog = ({ purchaseForm, onClose }) => {
  const {
    form,
    setForm,
    kind,
    changeKind,
    rows,
    updateRow,
    addRow,
    removeRow,
    saving,
    supplierOptions,
    itemOptions,
    paymentSourceOptions,
    selectedSource,
    totals,
    canPost,
    editingDraft,
    reset,
    saveDraft,
    receipts,
    preparingReceipts,
    addReceipts,
    removeReceipt,
    createSupplier,
    createItem,
    submit,
  } = purchaseForm;
  const isSupply = kind.key === "supply";
  // Kasir get sources without saldo (balance null).
  const showsBalance = selectedSource && selectedSource.balance != null;
  const balanceAfter = showsBalance ? selectedSource.balance - totals.total : null;

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
              {editingDraft ? `Draft Nota #${editingDraft.id}` : "Tambah Belanja"}
            </h2>
            <p className="mt-1 text-sm text-[#ababab]">
              Pilih &quot;Buat&quot; jika nama belum tersedia. Simpan Draft belum mengubah stok dan saldo;
              keduanya berubah saat nota diposting{canPost ? "" : " oleh admin"}.
            </p>
            {editingDraft && (
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#f6d365]">
                Mengubah draft {kind.label.toLowerCase()} #{editingDraft.id}
                {editingDraft.attachments.length > 0 && ` \u00b7 ${editingDraft.attachments.length} bukti tersimpan`}.
                <button
                  type="button"
                  disabled={saving}
                  onClick={reset}
                  className="rounded-md border border-[#f6d365]/40 px-2 py-0.5 text-xs font-semibold hover:bg-[#f6d365]/10"
                >
                  Mulai nota baru
                </button>
              </p>
            )}
          </div>
          <button type="button" disabled={saving} onClick={onClose} aria-label="Tutup form" className="p-2">
            x
          </button>
        </div>
        <fieldset disabled={saving} className="min-w-0">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#d6c7ae]">Informasi Nota</h3>
          <div className="mb-4">
            <span className="mb-1 block text-sm" id="purchase-kind-label">
              Jenis Belanja
            </span>
            <div role="group" aria-labelledby="purchase-kind-label" className="flex w-fit flex-wrap gap-1 rounded-lg bg-[#181818] p-1">
              {PURCHASE_KIND_LIST.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={kind.key === option.key}
                  disabled={Boolean(editingDraft) && kind.key !== option.key}
                  onClick={() => changeKind(option.key)}
                  className={kindButtonClass(kind.key === option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-[#ababab]">{kind.hint}</p>
          </div>
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
              <span className="mb-1 block text-sm">Sumber Pembayaran</span>
              <CreatableSelect2
                options={paymentSourceOptions}
                value={form.paymentSourceId}
                onSelect={(option) =>
                  setForm((current) => ({ ...current, paymentSourceId: option?.id || "" }))
                }
                placeholder="Pilih sumber pembayaran"
                label="Sumber Pembayaran"
                disabled={saving}
              />
              {showsBalance ? (
                <p className="mt-1 text-xs text-[#ababab]" data-testid="payment-source-balance">
                  Saldo {signedCurrency(selectedSource.balance)}, setelah belanja{" "}
                  <span className={balanceAfter < 0 ? "font-bold text-red-400" : "font-bold text-[#f5f5f5]"}>
                    {signedCurrency(balanceAfter)}
                  </span>
                </p>
              ) : (
                !selectedSource && (
                  <p className="mt-1 text-xs text-red-300">
                    Belum ada sumber pembayaran aktif. Tambahkan di Pengaturan.
                  </p>
                )
              )}
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
                  <div
                    className={`grid gap-3 sm:grid-cols-2 ${
                      isSupply
                        ? "lg:grid-cols-[minmax(220px,2fr)_minmax(140px,1fr)_minmax(80px,.6fr)_minmax(120px,1fr)_minmax(110px,.9fr)]"
                        : "lg:grid-cols-[minmax(220px,2fr)_minmax(80px,.6fr)_minmax(90px,.7fr)_minmax(120px,1fr)_minmax(120px,1fr)]"
                    }`}
                  >
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
                        placeholder={isSupply ? "Cari atau buat barang lainnya" : "Cari atau buat barang"}
                        disabled={saving}
                      />
                    </div>
                    {isSupply && (
                      <div>
                        <span className="mb-1 block text-sm">Kategori</span>
                        {selectedItem?.category ? (
                          <p className="py-2 font-semibold">{selectedItem.category}</p>
                        ) : (
                          <CreatableSelect2
                            options={SUPPLY_CATEGORY_OPTIONS}
                            value={row.category}
                            onSelect={(option) => updateRow(row.key, { category: option?.id || "" })}
                            placeholder="Pilih kategori"
                            label={`Kategori barang ${index + 1}`}
                            disabled={saving}
                          />
                        )}
                      </div>
                    )}
                    <label>
                      <span className="mb-1 block text-sm">{isSupply ? "Qty" : "Gramasi"}</span>
                      <input
                        required
                        type="text"
                        inputMode="decimal"
                        value={row.quantity}
                        onChange={(event) => updateRow(row.key, { quantity: event.target.value })}
                        className={inputClass}
                      />
                    </label>
                    {/* Barang Lainnya are counted per piece: no unit. */}
                    {kind.showUnits && (
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
                    )}
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
                  {kind.showUnits && selectedItem?.unit && (
                    <p className="mt-2 text-xs text-[#ababab]">
                      Satuan stok: {selectedItem.unit}. Isi gramasi sesuai satuan stok; COGS dihitung otomatis dari
                      harga total.
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
        </fieldset>
        <NotaSummary
          form={form}
          setForm={setForm}
          totals={totals}
          sourceName={selectedSource?.name}
          disabled={saving}
        />
        {/* Optional details come last, right above the save buttons. */}
        <fieldset disabled={saving} className="mt-5 min-w-0">
          <label className="block">
            <span className="mb-1 block text-sm">Catatan (opsional)</span>
            <textarea
              className={inputClass}
              maxLength={500}
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
            />
          </label>
          <div className="mt-4">
            <span className="mb-1 block text-sm">Bukti Nota (opsional)</span>
            <p className="mb-2 text-xs text-[#ababab]">
              Foto nota fisik atau kuitansi untuk audit keuangan.
            </p>
            <ReceiptPicker
              receipts={receipts}
              onAdd={addReceipts}
              onRemove={removeReceipt}
              max={MAX_RECEIPTS_PER_UPLOAD}
              disabled={saving}
              busy={preparingReceipts}
            />
          </div>
        </fieldset>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <strong>Total: {currency(totals.total)}</strong>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={saving} onClick={onClose} className="px-4 py-2">
              Tutup
            </button>
            <button
              type="button"
              disabled={saving || preparingReceipts}
              onClick={saveDraft}
              className="rounded-lg border border-[#a79981] px-4 py-2 text-sm font-bold text-[#d6c7ae] hover:bg-[#a79981]/10 disabled:opacity-50"
            >
              {saving ? "Menyimpan..." : "Simpan Draft"}
            </button>
            {canPost && (
              <button type="submit" disabled={saving || preparingReceipts} className={buttonClass}>
                {saving ? "Menyimpan..." : "Simpan & Posting"}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

export default PurchaseFormDialog;
