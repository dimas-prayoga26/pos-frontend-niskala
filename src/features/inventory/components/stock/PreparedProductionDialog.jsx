import { useState } from "react";
import { enqueueSnackbar } from "notistack";
import { currency, quantityDisplay } from "../../utils/format";
import {
  getProductionPortions,
  getProductionUsage,
  getStartingQuantities,
  getUsageCost,
} from "../../utils/preparedItems";
import { parseCostInput } from "../../utils/stockItems";
import { getJakartaDateKey } from "../../../../shared/lib/dates";

const inputClass =
  "w-full min-w-0 rounded-lg border border-[#555] bg-[#1f1f1f] px-3 py-2 text-[#f5f5f5] outline-none focus:border-[#d6c7ae]";

const Suffix = ({ children }) => (
  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-semibold text-[#ababab]">
    {children}
  </span>
);

// "Catat Masak", the kitchen's Daily Prep, in the order it happens: how much
// of each bahan baku was cooked (starting from the latest cooking's), then
// how many portions came out and the weight of one, on which business day
// (today, or an earlier day not yet closed). Its cost per portion goes to that
// day's notas whose HPP is still pending (Modul 2). Simpan asks once more,
// since saving takes the bahan baku out of stock; editing a field cancels
// that confirmation.
const PreparedProductionDialog = ({ item, stockItems, onSave, onCancel, isSaving }) => {
  const today = getJakartaDateKey();
  const [form, setForm] = useState(() => ({
    producedDate: today,
    quantities: getStartingQuantities(item),
    portionQuantity: "",
    portionSize: Number(item.portionSize) > 0 ? String(item.portionSize).replace(".", ",") : "",
    note: "",
  }));
  const [isConfirming, setIsConfirming] = useState(false);
  const usage = getProductionUsage(item, form.quantities, stockItems);
  const usedItems = usage.filter((used) => used.quantity > 0);
  const totalCost = getUsageCost(usage);
  const portions = getProductionPortions(form.portionQuantity);
  const portionSize = parseCostInput(form.portionSize);
  const shortItems = usage.filter((used) => used.isShort);
  const update = (changes) => {
    setForm((current) => ({ ...current, ...changes }));
    setIsConfirming(false);
  };
  const setField = (field) => (event) => update({ [field]: event.target.value });
  const setQuantity = (stockItemId) => (event) =>
    update({ quantities: { ...form.quantities, [String(stockItemId)]: event.target.value } });

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!usedItems.length) {
      enqueueSnackbar("Isi jumlah bahan baku yang dipakai.", { variant: "error" });
      return;
    }
    if (!(portions > 0)) {
      enqueueSnackbar("Isi jumlah porsi jadi.", { variant: "error" });
      return;
    }

    if (!form.producedDate || form.producedDate > today) {
      enqueueSnackbar("Tanggal masak tidak boleh setelah hari ini.", { variant: "error" });
      return;
    }
    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }

    onSave({
      items: usedItems.map((used) => ({ stockItemId: used.stockItemId, quantity: used.quantity })),
      portionQuantity: portions,
      portionSize: portionSize > 0 ? portionSize : 0,
      note: form.note,
      producedDate: form.producedDate,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={handleSubmit}
        aria-label="Form catat masak"
        className="max-h-[92vh] overflow-y-auto rounded-lg bg-[#262626] p-5 text-[#f5f5f5] shadow-2xl"
        style={{ width: "min(94vw, 560px)" }}
      >
        <h3 className="mb-4 border-b border-[#333] pb-3 text-lg font-bold">Catat Masak {item.name}</h3>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-semibold">Tanggal Masak</span>
          <input
            type="date"
            value={form.producedDate}
            max={today}
            onChange={setField("producedDate")}
            className={inputClass}
          />
        </label>

        <div className="mb-3 rounded-lg border border-[#333] bg-[#202020] p-3 text-sm">
          <span className="mb-2 block font-semibold">Bahan Baku Terpakai</span>
          <div className="space-y-2">
            {usage.map((used) => (
              <div
                key={used.stockItemId}
                className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_140px_96px]"
              >
                <span className="min-w-0">
                  {used.name}
                  <span className={`block text-xs ${used.isShort ? "font-semibold text-red-400" : "text-[#ababab]"}`}>
                    Stok sekarang: {used.isUnlimited ? "Bebas stok" : quantityDisplay(used.available, used.unit)}
                    {used.isShort && " (stok kurang)"}
                  </span>
                </span>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.quantities[String(used.stockItemId)] ?? ""}
                    onChange={setQuantity(used.stockItemId)}
                    aria-label={`Jumlah ${used.name}`}
                    className={`${inputClass} ${used.unit ? "pr-12" : ""}`}
                    placeholder="0"
                  />
                  {used.unit && <Suffix>{used.unit}</Suffix>}
                </div>
                <span className="hidden text-right font-semibold sm:block">{currency(used.cost)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
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
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Takaran 1 Porsi</span>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={form.portionSize}
                onChange={setField("portionSize")}
                className={`${inputClass} pr-10`}
                placeholder="Contoh: 150"
              />
              <Suffix>gr</Suffix>
            </div>
          </label>
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
          </div>
          <div>
            <span className="block text-[#ababab]">Harga Bahan</span>
            <strong className="block text-base">{currency(totalCost)}</strong>
          </div>
          <div>
            <span className="block text-[#ababab]">COGS per {item.unit}</span>
            <strong className="block text-base">
              {portions > 0 ? currency(totalCost / portions) : "-"}
            </strong>
          </div>
        </div>

        {isConfirming ? (
          <div className="rounded-lg border border-[#a79981] bg-[#2a2620] p-3 text-sm">
            <p className="font-semibold">Simpan catatan masak?</p>
            <p className="mt-1 text-[#ababab]">
              Stok bahan baku berkurang:{" "}
              {usedItems.map((used) => `${used.name} ${quantityDisplay(used.quantity, used.unit)}`).join(", ")}. Stok{" "}
              {item.name} bertambah {quantityDisplay(portions, item.unit)}.
            </p>
            <div className="mt-3 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsConfirming(false)}
                className="rounded-lg bg-[#333] px-4 py-2 text-sm font-semibold text-[#f5f5f5]"
              >
                Kembali
              </button>
              <button
                type="submit"
                disabled={isSaving || shortItems.length > 0}
                className="rounded-lg bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Menyimpan..." : "Ya, Simpan"}
              </button>
            </div>
          </div>
        ) : (
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
              Simpan
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default PreparedProductionDialog;
