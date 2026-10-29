import { useEffect, useState } from "react";
import { costDisplay, currency, quantityDisplay } from "../../utils/format";
import { getLogActionLabel, getLogDetail } from "../../utils/shopping";

const tabClass = (isActive) =>
  `rounded-md px-4 py-2 transition-colors ${
    isActive ? "bg-[#a79981] text-[#101010]" : "text-[#ababab] hover:bg-[#333] hover:text-white"
  }`;

const StatCard = ({ label, children, valueClassName = "" }) => (
  <div className="rounded-lg bg-[#262626] p-3">
    <span className="block text-xs font-semibold text-[#ababab]">{label}</span>
    <strong className={`mt-1 block ${valueClassName}`.trim()}>{children}</strong>
  </div>
);

// Purchase history and activity log of one item. Escape or a backdrop click closes it.
const PurchaseHistoryDialog = ({
  group,
  isAdmin,
  onClose,
  onEditItem,
  onDeleteItem,
  isDeleting,
  onOpenReceipts,
}) => {
  const [tab, setTab] = useState("history");

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const handleClose = (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shopping-history-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="max-h-[88vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-[#1f1f1f] p-5 text-[#f5f5f5] shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex flex-col gap-3 border-b border-[#333] pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="shopping-history-title" className="text-xl font-bold">
              {group.itemName}
            </h2>
            <p className="mt-1 text-sm text-[#ababab]">
              {group.purchaseCount} history pembelian
              {group.category && ` · ${group.category}`}
            </p>
          </div>
          <button
            type="button"
            onMouseDown={handleClose}
            onClick={handleClose}
            className="w-fit rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5]"
          >
            Tutup
          </button>
        </div>
        <div className="mb-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          <StatCard label="Stok Sekarang">
            {group.stock == null ? "-" : quantityDisplay(group.stock, group.stockUnit)}
          </StatCard>
          <StatCard label="Nilai Asset">{currency(group.stockValue)}</StatCard>
          <StatCard label="COGS Sekarang" valueClassName="text-[#f6d365]">
            {costDisplay(group.averageCost, group.stockUnit)}
          </StatCard>
        </div>
        <div className="mb-4 flex w-fit rounded-lg bg-[#181818] p-1 text-sm font-semibold">
          <button type="button" onClick={() => setTab("history")} className={tabClass(tab === "history")}>
            Riwayat
          </button>
          <button type="button" onClick={() => setTab("logs")} className={tabClass(tab === "logs")}>
            Log Aktivitas
          </button>
        </div>

        {tab === "history" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[#ababab]">
                <tr>
                  <th className="p-2">Tanggal</th>
                  <th className="p-2">Toko</th>
                  <th className="p-2">Gramasi</th>
                  <th className="p-2 text-right">Harga Satuan</th>
                  <th className="p-2 text-right">Jumlah</th>
                  <th className="p-2 text-right">Masuk Stok</th>
                  <th className="p-2 text-right">COGS Setelah</th>
                  {isAdmin && <th className="p-2 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {group.histories.map((item) => (
                  <tr key={item.id} className="border-t border-[#444]">
                    <td className="whitespace-nowrap p-2">
                      {String(item.purchaseDate).slice(0, 10)}
                      <p className="text-xs text-[#ababab]">
                        #{item.purchaseId} - {item.paymentMethod}
                      </p>
                      {(isAdmin || item.attachments?.length > 0) && (
                        <button
                          type="button"
                          onClick={() => onOpenReceipts(item.purchaseId)}
                          className="mt-1 rounded-md border border-[#a79981]/40 px-2 py-0.5 text-xs font-semibold text-[#d6c7ae] hover:bg-[#a79981]/10"
                        >
                          {item.attachments?.length ? `Bukti (${item.attachments.length})` : "+ Bukti"}
                        </button>
                      )}
                    </td>
                    <td className="p-2">{item.supplierName}</td>
                    <td className="p-2">{quantityDisplay(item.quantity, item.unit)}</td>
                    <td className="p-2 text-right">{currency(item.unitPrice)}</td>
                    <td className="p-2 text-right">
                      {currency(item.total)}
                      {item.costTotal != null && item.costTotal !== item.total && (
                        <p className="text-xs text-[#ababab]" title="Termasuk bagian ongkir, diskon, dan PPN nota">
                          Masuk stok: {currency(item.costTotal)}
                        </p>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      {quantityDisplay(item.stockQuantity, item.stockUnit)}
                    </td>
                    <td className="p-2 text-right">
                      {costDisplay(item.stockAverageCost, item.stockUnit)}
                      <p className="text-xs text-[#ababab]">Nilai: {currency(item.stockValueAfter)}</p>
                    </td>
                    {isAdmin && (
                      <td className="p-2 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onEditItem(item)}
                            className="rounded-md bg-[#2b2b2b] px-3 py-1.5 text-sm font-semibold text-[#f5f5f5] hover:bg-[#3a3a3a]"
                          >
                            Update
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteItem(item)}
                            disabled={isDeleting}
                            className="rounded-md bg-[#331f1f] px-3 py-1.5 text-sm font-semibold text-red-300 hover:bg-[#442424] disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[#ababab]">
                <tr>
                  <th className="p-2">Waktu</th>
                  <th className="p-2">User</th>
                  <th className="p-2">Aksi</th>
                  <th className="p-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {(group.logs || []).map((log) => (
                  <tr key={log.id} className="border-t border-[#444]">
                    <td className="whitespace-nowrap p-2">
                      {new Date(log.createdAt).toLocaleString("id-ID")}
                    </td>
                    <td className="p-2">{log.userName || "-"}</td>
                    <td className="p-2 font-semibold">{getLogActionLabel(log)}</td>
                    <td className="p-2 text-[#ababab]">{getLogDetail(log)}</td>
                  </tr>
                ))}
                {!(group.logs || []).length && (
                  <tr>
                    <td className="p-3 text-center text-[#ababab]" colSpan={4}>
                      Belum ada log aktivitas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PurchaseHistoryDialog;
