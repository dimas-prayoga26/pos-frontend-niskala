import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDateAndTime } from "../../../../shared/lib/dates";
import { getSemiWastes } from "../../api";
import { quantityDisplay, signedCurrency } from "../../utils/format";

const REASON_CLASS_NAMES = {
  "Sisa akhir hari": "bg-[#3b3b3b] text-[#d6c7ae]",
  Penyesuaian: "bg-[#2f3a4a] text-[#a9c7f5]",
};

const formatDay = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

// Kerugian of bahan setengah jadi: portions thrown away per day (leftover at
// the daily recap, spoiled, spilled, a lower stock count). Admins can undo the
// latest write-off of an item.
const PreparedWasteHistoryDialog = ({ isAdmin, onUndo, isUndoing, onClose }) => {
  const [confirmingId, setConfirmingId] = useState(null);
  const { data, isPending, isError } = useQuery({
    queryKey: ["semi-wastes", "history"],
    queryFn: () => getSemiWastes(),
  });
  const wastes = data?.data?.data?.wastes || [];
  const dailyTotals = data?.data?.data?.dailyTotals || [];
  // The newest write-off of each item (highest id) is the one that can be undone.
  const latestIdByItem = new Map();
  for (const waste of wastes) {
    if (waste.semiItemId && waste.id > (latestIdByItem.get(waste.semiItemId) || 0)) {
      latestIdByItem.set(waste.semiItemId, waste.id);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-label="Riwayat kerugian"
        className="max-h-[92vh] overflow-y-auto rounded-lg bg-[#262626] p-5 text-[#f5f5f5] shadow-2xl"
        style={{ width: "min(94vw, 680px)" }}
      >
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#333] pb-3">
          <div>
            <h3 className="text-lg font-bold">Riwayat Kerugian</h3>
            <p className="mt-1 text-sm text-[#ababab]">
              Porsi bahan setengah jadi yang dibuang, dihitung dengan harga per porsi saat itu.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#333] px-4 py-2 text-sm font-semibold text-[#f5f5f5]"
          >
            Tutup
          </button>
        </div>

        {isPending && <p className="text-sm text-[#ababab]">Memuat riwayat kerugian...</p>}
        {isError && <p className="text-sm text-red-400">Riwayat kerugian belum bisa dimuat.</p>}
        {!isPending && !isError && wastes.length === 0 && (
          <p className="text-sm text-[#ababab]">Belum ada porsi yang dibuang.</p>
        )}

        {dailyTotals.length > 0 && (
          <div className="mb-4 rounded-lg border border-[#333] bg-[#202020] p-3 text-sm">
            <p className="mb-2 font-semibold">Kerugian per hari</p>
            {dailyTotals.slice(0, 7).map((day) => (
              <div key={day.date} className="flex justify-between gap-3 py-1">
                <span className="text-[#ababab]">{formatDay(day.date)}</span>
                <span className={`font-semibold ${day.cost < 0 ? "text-green-400" : "text-red-400"}`}>
                  {signedCurrency(day.cost)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          {wastes.map((waste) => (
            <div key={waste.id} className="rounded-lg border border-[#333] bg-[#202020] p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {waste.itemName} ·{" "}
                    {/* A recount above the stock: a selisih lebih, not a loss. */}
                    {waste.quantity < 0
                      ? `lebih ${quantityDisplay(-waste.quantity, waste.unit)}`
                      : quantityDisplay(waste.quantity, waste.unit)}
                  </p>
                  <p className="mt-1 text-xs text-[#ababab]">
                    {formatDay(waste.wasteDate)} · dicatat {formatDateAndTime(waste.createdAt)}
                    {waste.userName && ` · ${waste.userName}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${waste.cost < 0 ? "text-green-400" : "text-red-400"}`}>
                    {signedCurrency(waste.cost)}
                  </p>
                  <span
                    className={`mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${
                      REASON_CLASS_NAMES[waste.reason] || "bg-[#4a2e2e] text-red-300"
                    }`}
                  >
                    {waste.reason}
                  </span>
                </div>
              </div>
              {waste.note && <p className="mt-1 text-xs text-[#ababab]">{waste.note}</p>}

              {isAdmin && latestIdByItem.get(waste.semiItemId) === waste.id && (
                <div className="mt-3 flex justify-end gap-2">
                  {confirmingId === waste.id ? (
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
                        onClick={() => onUndo(waste.id)}
                        className="rounded-md bg-red-500 px-3 py-1 text-xs font-bold text-white disabled:opacity-60"
                      >
                        {isUndoing ? "Membatalkan..." : "Ya, kembalikan ke stok"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(waste.id)}
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

export default PreparedWasteHistoryDialog;
