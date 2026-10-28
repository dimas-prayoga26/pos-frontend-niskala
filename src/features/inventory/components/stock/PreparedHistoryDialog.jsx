import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDateAndTime } from "../../../../shared/lib/dates";
import { getSemiProductions } from "../../api";
import { currency, quantityDisplay } from "../../utils/format";

// Cooking history of a bahan setengah jadi with the bahan baku each cooking
// used. Admins can undo the latest cooking while its portions are in stock.
const PreparedHistoryDialog = ({ item, isAdmin, onUndo, isUndoing, onClose }) => {
  const [confirmingId, setConfirmingId] = useState(null);
  const { data, isPending, isError } = useQuery({
    queryKey: ["semi-productions", item.id || item._id],
    queryFn: () => getSemiProductions(item.id || item._id),
  });
  const productions = data?.data?.data || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-label={`Riwayat masak ${item.name}`}
        className="max-h-[92vh] overflow-y-auto rounded-lg bg-[#262626] p-5 text-[#f5f5f5] shadow-2xl"
        style={{ width: "min(94vw, 620px)" }}
      >
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#333] pb-3">
          <div>
            <h3 className="text-lg font-bold">Riwayat Masak {item.name}</h3>
            <p className="mt-1 text-sm text-[#ababab]">30 catatan terakhir.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#333] px-4 py-2 text-sm font-semibold text-[#f5f5f5]"
          >
            Tutup
          </button>
        </div>

        {isPending && <p className="text-sm text-[#ababab]">Memuat riwayat masak...</p>}
        {isError && <p className="text-sm text-red-400">Riwayat masak belum bisa dimuat.</p>}
        {!isPending && !isError && productions.length === 0 && (
          <p className="text-sm text-[#ababab]">Belum ada catatan masak.</p>
        )}

        <div className="space-y-3">
          {productions.map((production, index) => (
            <div key={production.id} className="rounded-lg border border-[#333] bg-[#202020] p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {quantityDisplay(production.batchQuantity, "resep")} →{" "}
                    {quantityDisplay(production.portionQuantity, item.unit)}
                  </p>
                  <p className="mt-1 text-xs text-[#ababab]">
                    {formatDateAndTime(production.producedAt)}
                    {production.userName && ` · ${production.userName}`}
                    {production.outputWeight != null &&
                      ` · ditimbang ${quantityDisplay(production.outputWeight, "gr")}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{currency(production.cost)}</p>
                  <p className="mt-1 text-xs text-[#ababab]">
                    {currency(production.unitCost)} / {item.unit}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-[#d6c7ae]">
                {production.items
                  .map((used) => `${used.name} ${quantityDisplay(used.quantity, used.unit)}`)
                  .join(", ")}
              </p>
              {production.note && <p className="mt-1 text-xs text-[#ababab]">{production.note}</p>}

              {isAdmin && index === 0 && (
                <div className="mt-3 flex justify-end gap-2">
                  {confirmingId === production.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        className="rounded-md bg-[#333] px-3 py-1 text-xs font-semibold"
                      >
                        Tidak
                      </button>
                      <button
                        type="button"
                        disabled={isUndoing}
                        onClick={() => onUndo(production.id)}
                        className="rounded-md bg-red-500 px-3 py-1 text-xs font-bold text-white disabled:opacity-60"
                      >
                        {isUndoing ? "Membatalkan..." : "Ya, batalkan"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(production.id)}
                      className="rounded-md bg-[#333] px-3 py-1 text-xs font-semibold text-red-400"
                    >
                      Batalkan
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PreparedHistoryDialog;
