import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { getStockOpnameUsage } from "../../api";
import { currency, quantityDisplay } from "../../utils/format";
import { costClassName } from "../../utils/lossHistory";
import { getOpnameLine, isCountable, shrinkageLabel, valueChangeDisplay } from "../../utils/opname";

const inputClass =
  "w-full min-w-0 rounded-lg border border-[#555] bg-[#1f1f1f] px-3 py-2 text-[#f5f5f5] outline-none focus:border-[#d6c7ae]";

const KIND_LABELS = { raw: "Bahan Baku", semi: "Bahan Olahan" };
const NO_USAGE = [];

const SelisihCell = ({ line, unit }) => {
  if (!line) return <span className="text-[#777]">-</span>;
  if (line.isInvalid) return <span className="font-semibold text-red-400">Tidak valid</span>;
  if (line.difference === 0) return <span className="text-[#ababab]">Cocok</span>;

  return line.difference > 0 ? (
    <span className="font-semibold text-red-400">Kurang {quantityDisplay(line.difference, unit)}</span>
  ) : (
    <span className="font-semibold text-green-400">Lebih {quantityDisplay(-line.difference, unit)}</span>
  );
};

// Stock Opname (Modul 3) of one kind: every bahan with its system stock and
// what today's orders took from it (Terpakai, since its last count today);
// it opens on the bahan orders used (Terpakai Pesanan) when there are any.
// Staff type only the physical count (fisik) of the bahan they counted, the
// others stay as they are. Selisih and its value (-Rp kurang, +Rp lebih)
// follow each count, the total as Kehilangan / Kelebihan Persediaan. Simpan
// asks once more, since each counted stock becomes its count; editing a field
// cancels that confirmation.
const StockOpnameDialog = ({ kind, items, onSave, onCancel, isSaving }) => {
  const [counts, setCounts] = useState({});
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  // "used" | "all"; until picked, "used" when orders used any bahan.
  const [view, setView] = useState(null);
  const { data: usageRes } = useQuery({
    queryKey: ["stock-opnames", "usage", kind],
    queryFn: () => getStockOpnameUsage(kind),
  });
  const usage = usageRes?.data?.data?.usage || NO_USAGE;
  const rows = useMemo(() => {
    const usedById = new Map(usage.map((row) => [String(row.itemId), Number(row.quantity) || 0]));
    return items.filter(isCountable).map((item) => ({
      item,
      used: usedById.get(String(item.id)) || 0,
      line: getOpnameLine(item, counts[String(item.id)]),
    }));
  }, [items, counts, usage]);
  const usedRows = rows.filter(({ used }) => used > 0);
  const activeView = view || (usedRows.length ? "used" : "all");
  const viewRows = activeView === "used" ? usedRows : rows;
  const query = search.trim().toLowerCase();
  const visibleRows = query ? viewRows.filter(({ item }) => item.name.toLowerCase().includes(query)) : viewRows;
  const views = [
    { key: "used", label: `Terpakai Pesanan (${usedRows.length})` },
    { key: "all", label: `Semua (${rows.length})` },
  ];
  const counted = rows.filter(({ line }) => line && !line.isInvalid);
  const changed = counted.filter(({ line }) => line.difference !== 0);
  const hasInvalid = rows.some(({ line }) => line?.isInvalid);
  const totalCost = changed.reduce((total, { line }) => total + line.cost, 0);

  const setCount = (itemId) => (event) => {
    setCounts((current) => ({ ...current, [String(itemId)]: event.target.value }));
    setIsConfirming(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (hasInvalid) {
      enqueueSnackbar("Stok fisik harus angka 0 atau lebih.", { variant: "error" });
      return;
    }
    if (!counted.length) {
      enqueueSnackbar("Isi stok fisik minimal satu bahan.", { variant: "error" });
      return;
    }
    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }

    onSave({
      kind,
      counts: counted.map(({ item, line }) => ({ itemId: item.id || item._id, actualStock: line.actualStock })),
      note: note.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={handleSubmit}
        aria-label="Form stock opname"
        className="flex max-h-[92vh] flex-col rounded-lg bg-[#262626] p-5 text-[#f5f5f5] shadow-2xl"
        style={{ width: "min(96vw, 860px)" }}
      >
        <div className="mb-3 flex flex-col gap-2 border-b border-[#333] pb-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-bold">Stock Opname {KIND_LABELS[kind]}</h3>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            type="search"
            aria-label="Cari bahan"
            placeholder="Cari bahan"
            className={`${inputClass} sm:w-64`}
          />
        </div>

        <div role="group" aria-label="Tampilkan bahan" className="mb-3 flex w-fit rounded-lg bg-[#1f1f1f] p-1">
          {views.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={activeView === key}
              onClick={() => setView(key)}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-bold ${
                activeView === key ? "bg-[#a79981] text-[#101010]" : "text-[#ababab]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[#333]">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[#333] text-[#ababab]">
              <tr>
                <th className="p-3">Bahan</th>
                <th className="p-3 text-right">Sistem</th>
                <th className="p-3 text-right" title="Dipakai pesanan hari ini">
                  Terpakai
                </th>
                <th className="p-3">Fisik</th>
                <th className="p-3">Selisih</th>
                <th className="p-3 text-right">Nilai</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-[#ababab]">
                    {query && viewRows.length
                      ? "Bahan tidak ditemukan."
                      : activeView === "used"
                        ? "Belum ada bahan terpakai pesanan hari ini."
                        : "Belum ada bahan untuk dihitung."}
                  </td>
                </tr>
              )}
              {visibleRows.map(({ item, used, line }) => (
                <tr key={item.id || item._id} className="border-t border-[#333]">
                  <td className="p-3 font-semibold">{item.name}</td>
                  <td className="whitespace-nowrap p-3 text-right">{quantityDisplay(item.stock, item.unit)}</td>
                  <td className="whitespace-nowrap p-3 text-right text-[#ababab]">
                    {used > 0 ? quantityDisplay(used, item.unit) : "-"}
                  </td>
                  <td className="p-3">
                    <div className="relative w-32">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={counts[String(item.id)] ?? ""}
                        onChange={setCount(item.id)}
                        aria-label={`Fisik ${item.name}`}
                        className={`${inputClass} pr-12`}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-[#ababab]">
                        {item.unit}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap p-3">
                    <SelisihCell line={line} unit={item.unit} />
                  </td>
                  <td className="whitespace-nowrap p-3 text-right">
                    {line && !line.isInvalid && line.difference !== 0 ? (
                      <span className={`font-semibold ${costClassName(line.cost)}`}>{valueChangeDisplay(line.cost)}</span>
                    ) : (
                      <span className="text-[#777]">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-semibold">Catatan</span>
          <input
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              setIsConfirming(false);
            }}
            className={inputClass}
            placeholder="Opsional"
          />
        </label>

        <div className="mt-3 grid gap-2 rounded-lg bg-[#1f1f1f] p-3 text-sm sm:grid-cols-3">
          <div>
            <span className="block text-[#ababab]">Dihitung</span>
            <strong className="block text-base">{counted.length} bahan</strong>
          </div>
          <div>
            <span className="block text-[#ababab]">Selisih</span>
            <strong className="block text-base">{changed.length} bahan</strong>
          </div>
          <div>
            <span className="block text-[#ababab]">{shrinkageLabel(totalCost)}</span>
            <strong className={`block text-base ${totalCost === 0 ? "" : costClassName(totalCost)}`}>
              {currency(Math.abs(totalCost))}
            </strong>
          </div>
        </div>

        {isConfirming ? (
          <div className="mt-4 rounded-lg border border-[#a79981] bg-[#2a2620] p-3 text-sm">
            <p className="font-semibold">Simpan stock opname?</p>
            <p className="mt-1 text-[#ababab]">
              {changed.length
                ? `Stok ${changed.length} bahan disesuaikan ke angka fisik.`
                : "Semua stok fisik cocok dengan sistem."}
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
                disabled={isSaving}
                className="rounded-lg bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Menyimpan..." : "Ya, Simpan"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex justify-end gap-3">
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
              Simpan
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default StockOpnameDialog;
