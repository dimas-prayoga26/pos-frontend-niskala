import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOrderItemCosts } from "../../https";
import { costDisplay, currency, quantityDisplay } from "../../features/inventory/utils/format";

const cellClass = "px-3 py-2.5";

// Rincian HPP of a menu sold on one nota (Rekap New): each bahan with its
// COGS as frozen at the sale, per portion and for every portion sold, and the
// total cost of the item. item: a row of the Rekap New ({ orderItemId, menu }).
const RecapItemCostDialog = ({ item, onClose }) => {
  const { data, isPending, isError } = useQuery({
    queryKey: ["order-item-costs", item.orderItemId],
    queryFn: () => getOrderItemCosts(item.orderItemId),
  });
  const costs = data?.data?.data;

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recap-item-cost-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-[#262626] p-5 text-[#f5f5f5] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 id="recap-item-cost-title" className="text-xl font-bold">
              {item.menu}
            </h3>
            {costs && (
              <p className="mt-1 text-sm text-[#ababab]">
                {costs.quantity} terjual · HPP per porsi {currency(costs.hppCost)}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold">
            Tutup
          </button>
        </div>

        {isPending && <p className="text-sm text-[#ababab]">Memuat rincian HPP...</p>}
        {isError && <p className="text-sm text-red-300">Gagal memuat rincian HPP.</p>}
        {costs && (
          <div className="overflow-x-auto rounded-lg border border-[#3a3a3a]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#202020] text-[#ababab]">
                <tr>
                  <th className={cellClass}>Bahan</th>
                  <th className={`${cellClass} text-right`}>Per Porsi</th>
                  <th className={`${cellClass} text-right`}>COGS</th>
                  <th className={`${cellClass} text-right`}>Total Pakai</th>
                  <th className={`${cellClass} text-right`}>Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {costs.lines.map((line) => (
                  <tr key={line.id} className="border-t border-[#3a3a3a]">
                    <td className={cellClass}>
                      <span className="font-semibold">{line.name}</span>
                      {line.hppType === "olahan" && (
                        <span className="ml-2 rounded bg-[#303030] px-1.5 py-0.5 text-[10px] font-semibold text-[#d6c7ae]">
                          Olahan{line.isPending ? " · sementara" : ""}
                        </span>
                      )}
                    </td>
                    <td className={`${cellClass} text-right`}>{quantityDisplay(line.quantity, line.unit)}</td>
                    <td className={`${cellClass} text-right`}>{costDisplay(line.unitCost, line.unit)}</td>
                    <td className={`${cellClass} text-right`}>{quantityDisplay(line.totalQuantity, line.unit)}</td>
                    <td className={`${cellClass} text-right font-semibold`}>{currency(line.totalCost)}</td>
                  </tr>
                ))}
                {costs.lines.length === 0 && (
                  <tr>
                    <td className={`${cellClass} text-[#ababab]`} colSpan={5}>
                      {costs.hppCost > 0 ? "Rincian bahan tidak tersimpan untuk pesanan ini." : "Tidak ada bahan tercatat saat menu ini terjual."}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="border-t-2 border-[#a79981]/60 bg-[#202020]">
                <tr>
                  <td className={`${cellClass} font-bold`} colSpan={4}>
                    Total Cost
                  </td>
                  <td className={`${cellClass} whitespace-nowrap text-right text-base font-bold text-[#f6d365]`} data-testid="item-total-cost">
                    {currency(costs.totalCost)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecapItemCostDialog;
