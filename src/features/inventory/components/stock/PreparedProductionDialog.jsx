import { useState } from "react";
import { enqueueSnackbar } from "notistack";
import { currency, quantityDisplay } from "../../utils/format";
import {
  describeComposition,
  getProductionPortions,
  getProductionUsage,
  getUsageCost,
} from "../../utils/preparedItems";
import { parseCostInput } from "../../utils/stockItems";

const inputClass =
  "w-full rounded-lg border border-[#555] bg-[#1f1f1f] px-3 py-2 text-[#f5f5f5] outline-none focus:border-[#d6c7ae]";
const modeButtonClass = (active) =>
  `flex-1 rounded-md px-3 py-2 text-sm font-bold ${
    active ? "bg-[#a79981] text-[#101010]" : "text-[#ababab] hover:bg-[#2f2f2f]"
  }`;

// "Catat Masak": how many recipes were cooked and what came out, weighed
// (result / portion size) or counted. Shows the raw items it will use.
const PreparedProductionDialog = ({ item, stockItems, onSave, onCancel, isSaving }) => {
  const [form, setForm] = useState({
    batchQuantity: "1",
    mode: item.portionSize > 0 ? "weight" : "count",
    outputWeight: "",
    portionQuantity: "",
    note: "",
  });
  const usage = getProductionUsage(item, form.batchQuantity, stockItems);
  const totalCost = getUsageCost(usage);
  const portions = getProductionPortions(form, item.portionSize);
  const batch = parseCostInput(form.batchQuantity);
  const shortItems = usage.filter((used) => used.isShort);
  const setField = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!(batch > 0)) {
      enqueueSnackbar("Jumlah resep yang dimasak harus lebih dari 0.", { variant: "error" });
      return;
    }
    if (form.mode === "weight" && !(item.portionSize > 0)) {
      enqueueSnackbar("Isi takaran 1 porsi lewat Ubah, atau hitung porsi langsung.", {
        variant: "error",
      });
      return;
    }
    if (!(portions > 0)) {
      enqueueSnackbar("Isi berat hasil masak atau jumlah porsinya.", { variant: "error" });
      return;
    }

    onSave(
      form.mode === "weight"
        ? { batchQuantity: batch, outputWeight: parseCostInput(form.outputWeight), note: form.note }
        : { batchQuantity: batch, portionQuantity: portions, note: form.note }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={handleSubmit}
        aria-label="Form catat masak"
        className="max-h-[92vh] overflow-y-auto rounded-lg bg-[#262626] p-5 text-[#f5f5f5] shadow-2xl"
        style={{ width: "min(94vw, 560px)" }}
      >
        <div className="mb-4 border-b border-[#333] pb-3">
          <h3 className="text-lg font-bold">Catat Masak {item.name}</h3>
          <p className="mt-1 text-sm text-[#ababab]">
            1 resep: {describeComposition(item.components) || "-"}
          </p>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-semibold">Berapa Resep Dimasak</span>
          <input
            type="text"
            inputMode="decimal"
            value={form.batchQuantity}
            onChange={setField("batchQuantity")}
            className={inputClass}
            placeholder="Contoh: 5"
          />
        </label>

        <div className="mb-3 flex gap-1 rounded-lg bg-[#1f1f1f] p-1">
          <button
            type="button"
            onClick={() => setForm((current) => ({ ...current, mode: "weight" }))}
            className={modeButtonClass(form.mode === "weight")}
          >
            Timbang Hasil
          </button>
          <button
            type="button"
            onClick={() => setForm((current) => ({ ...current, mode: "count" }))}
            className={modeButtonClass(form.mode === "count")}
          >
            Hitung Porsi
          </button>
        </div>

        {form.mode === "weight" ? (
          <label className="mb-3 block">
            <span className="mb-1 block text-sm font-semibold">Berat Hasil Masak (gr)</span>
            <input
              type="text"
              inputMode="decimal"
              value={form.outputWeight}
              onChange={setField("outputWeight")}
              className={inputClass}
              placeholder="Contoh: 12000"
            />
            <span className="mt-1 block text-xs text-[#ababab]">
              {item.portionSize > 0
                ? `Takaran 1 porsi ${quantityDisplay(item.portionSize, "gr")}.`
                : "Takaran 1 porsi belum diisi. Isi lewat Ubah, atau pakai Hitung Porsi."}
            </span>
          </label>
        ) : (
          <label className="mb-3 block">
            <span className="mb-1 block text-sm font-semibold">Jumlah Porsi Jadi ({item.unit})</span>
            <input
              type="text"
              inputMode="decimal"
              value={form.portionQuantity}
              onChange={setField("portionQuantity")}
              className={inputClass}
              placeholder="Contoh: 80"
            />
          </label>
        )}

        <div className="mb-3 rounded-lg border border-[#333] bg-[#202020] p-3 text-sm">
          <span className="mb-2 block font-semibold">Bahan Terpakai</span>
          {usage.map((used) => (
            <div key={used.stockItemId} className="flex items-center justify-between gap-3 py-1">
              <span>
                {used.name} {quantityDisplay(used.quantity, used.unit)}
                {used.isShort && (
                  <span className="ml-2 text-xs font-semibold text-red-400">
                    stok kurang, sisa {quantityDisplay(used.available, used.unit)}
                  </span>
                )}
              </span>
              <span className="font-semibold">{currency(used.cost)}</span>
            </div>
          ))}
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-semibold">Catatan</span>
          <input
            value={form.note}
            onChange={setField("note")}
            className={inputClass}
            placeholder="Opsional"
          />
        </label>

        <div className="mb-5 grid gap-2 rounded-lg bg-[#1f1f1f] p-3 text-sm sm:grid-cols-3">
          <div>
            <span className="block text-[#ababab]">Hasil</span>
            <strong className="block text-base">{quantityDisplay(portions, item.unit)}</strong>
            {batch > 0 && portions > 0 && (
              <span className="block text-xs text-[#ababab]">
                {quantityDisplay(portions / batch, item.unit)} / resep
              </span>
            )}
          </div>
          <div>
            <span className="block text-[#ababab]">Biaya Bahan</span>
            <strong className="block text-base">{currency(totalCost)}</strong>
          </div>
          <div>
            <span className="block text-[#ababab]">Biaya per {item.unit}</span>
            <strong className="block text-base">
              {portions > 0 ? currency(totalCost / portions) : "-"}
            </strong>
          </div>
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
            disabled={isSaving || shortItems.length > 0}
            className="rounded-lg bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PreparedProductionDialog;
