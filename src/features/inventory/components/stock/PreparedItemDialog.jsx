import { useState } from "react";
import { enqueueSnackbar } from "notistack";
import { currency } from "../../utils/format";
import { getComponentCost, toPreparedPayload } from "../../utils/preparedItems";
import { isRecipeIngredient } from "../../utils/stockItems";

const inputClass =
  "w-full min-w-0 rounded-lg border border-[#555] bg-[#1f1f1f] px-3 py-2 text-[#f5f5f5] outline-none focus:border-[#d6c7ae]";

const emptyComponent = () => ({ stockItemId: "", quantity: "" });

const toForm = (item) => ({
  name: item?.name || "",
  unit: item?.unit || "porsi",
  portionSize: item?.portionSize ? String(item.portionSize) : "",
  minimumStock: item?.minimumStock ? String(item.minimumStock) : "",
  resetDaily: item ? Boolean(item.resetDaily) : true,
  components: item?.components?.length
    ? item.components.map((component) => ({
        stockItemId: String(component.stockItemId),
        quantity: String(component.quantity),
      }))
    : [emptyComponent()],
});

// Adds or edits a prepared item: its portion size and the raw items of one
// recipe (batch), each in its own stock unit.
const PreparedItemDialog = ({ item, rawItems, onSave, onCancel, isSaving }) => {
  const [form, setForm] = useState(() => toForm(item));
  const rawById = new Map(rawItems.map((raw) => [String(raw.id || raw._id), raw]));
  const recipeCost = form.components.reduce(
    (total, component) => total + getComponentCost(component.quantity, rawById.get(component.stockItemId)),
    0
  );
  const setField = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));
  const setComponent = (index, field, value) =>
    setForm((current) => ({
      ...current,
      components: current.components.map((component, componentIndex) =>
        componentIndex === index ? { ...component, [field]: value } : component
      ),
    }));

  const handleSubmit = (event) => {
    event.preventDefault();

    const payload = toPreparedPayload(form);
    if (!payload.name) {
      enqueueSnackbar("Nama bahan setengah jadi wajib diisi.", { variant: "error" });
      return;
    }
    if (!payload.components.length) {
      enqueueSnackbar("Isi minimal satu bahan beserta takarannya.", { variant: "error" });
      return;
    }

    onSave({ id: item?.id || item?._id, ...payload });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={handleSubmit}
        aria-label="Form bahan setengah jadi"
        className="max-h-[92vh] overflow-y-auto rounded-lg bg-[#262626] p-5 text-[#f5f5f5] shadow-2xl"
        style={{ width: "min(94vw, 620px)" }}
      >
        <div className="mb-4 border-b border-[#333] pb-3">
          <h3 className="text-lg font-bold">{item ? "Ubah Bahan Setengah Jadi" : "Tambah Bahan Setengah Jadi"}</h3>
          <p className="mt-1 text-sm text-[#ababab]">
            Contoh: Nasi dari Beras 1 kg, Sambal dari Cabai, Bawang, Minyak, dan Garam.
          </p>
        </div>

        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-sm font-semibold">Nama</span>
            <input
              value={form.name}
              onChange={setField("name")}
              className={inputClass}
              placeholder="Contoh: Nasi"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-semibold">Satuan Stok</span>
            <input
              value={form.unit}
              onChange={setField("unit")}
              className={inputClass}
              placeholder="porsi"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-semibold">Takaran 1 Porsi (gr)</span>
            <input
              type="text"
              inputMode="decimal"
              value={form.portionSize}
              onChange={setField("portionSize")}
              className={inputClass}
              placeholder="Contoh: 150"
            />
            <span className="mt-1 block text-xs text-[#ababab]">
              Berat hasil masak untuk 1 porsi (1 centong, 1 sendok).
            </span>
          </label>
          <label>
            <span className="mb-1 block text-sm font-semibold">Minimum Stok ({form.unit || "porsi"})</span>
            <input
              type="text"
              inputMode="decimal"
              value={form.minimumStock}
              onChange={setField("minimumStock")}
              className={inputClass}
              placeholder="0"
            />
          </label>
        </div>

        <label className="mb-3 flex items-start gap-3 rounded-lg border border-[#333] bg-[#202020] p-3">
          <input
            type="checkbox"
            checked={form.resetDaily}
            onChange={(event) =>
              setForm((current) => ({ ...current, resetDaily: event.target.checked }))
            }
            className="mt-1 h-4 w-4 accent-[#a79981]"
          />
          <span>
            <span className="block text-sm font-semibold">Habis setiap hari</span>
            <span className="block text-xs text-[#ababab]">
              Saat Rekap Harian disimpan, sisa porsinya dicatat sebagai kerugian (Sisa akhir hari)
              dan stok mulai dari 0 lagi. Matikan untuk bahan yang tahan beberapa hari, misalnya
              Sambal.
            </span>
          </span>
        </label>

        <div className="mb-3 rounded-lg border border-[#333] bg-[#202020] p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <span className="block text-sm font-semibold">Komposisi 1 Resep</span>
              <span className="block text-xs text-[#ababab]">
                Bahan untuk satu kali masak, dalam satuan stok masing-masing bahan.
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  components: [...current.components, emptyComponent()],
                }))
              }
              className="shrink-0 rounded-md bg-[#333] px-3 py-1 text-xs font-bold text-[#f5f5f5]"
            >
              Tambah Bahan
            </button>
          </div>

          <div className="space-y-2">
            {form.components.map((component, index) => {
              const raw = rawById.get(component.stockItemId);

              return (
                <div
                  key={index}
                  className="grid grid-cols-[minmax(0,1fr)_80px_44px_32px] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_96px_56px_96px_32px]"
                >
                  <select
                    value={component.stockItemId}
                    onChange={(event) => setComponent(index, "stockItemId", event.target.value)}
                    aria-label={`Bahan ${index + 1}`}
                    className={inputClass}
                  >
                    <option value="">Pilih bahan</option>
                    {rawItems
                      .filter(
                        (rawItem) =>
                          isRecipeIngredient(rawItem) ||
                          String(rawItem.id || rawItem._id) === component.stockItemId
                      )
                      .map((rawItem) => (
                        <option key={rawItem.id || rawItem._id} value={String(rawItem.id || rawItem._id)}>
                          {rawItem.name}
                        </option>
                      ))}
                  </select>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={component.quantity}
                    onChange={(event) => setComponent(index, "quantity", event.target.value)}
                    aria-label={`Takaran bahan ${index + 1}`}
                    className={inputClass}
                    placeholder="Takaran"
                  />
                  <span className="text-sm font-semibold text-[#ababab]">{raw?.unit || "-"}</span>
                  <span className="hidden text-right text-sm font-semibold sm:block">
                    {currency(getComponentCost(component.quantity, raw))}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        components:
                          current.components.length > 1
                            ? current.components.filter((_, componentIndex) => componentIndex !== index)
                            : [emptyComponent()],
                      }))
                    }
                    aria-label={`Hapus bahan ${index + 1}`}
                    className="rounded-md bg-[#333] py-1 text-sm font-bold text-red-400"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mb-5 rounded-lg bg-[#1f1f1f] p-3 text-sm">
          <span className="block text-[#ababab]">Biaya Bahan 1 Resep (harga sekarang)</span>
          <strong className="mt-1 block text-base">{currency(recipeCost)}</strong>
          <span className="mt-1 block text-xs text-[#ababab]">
            Jumlah porsi dan biaya per porsi didapat saat Catat Masak dari berat hasil masak.
          </span>
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

export default PreparedItemDialog;
