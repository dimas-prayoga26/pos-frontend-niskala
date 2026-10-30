import { useEffect } from "react";
import { formatDayMonthYear } from "../../../../shared/lib/dates";
import { currency, quantityDisplay, signedCurrency } from "../../utils/format";
import { notaFooterLines, packedQuantityLabel } from "../../utils/shopping";

const linkClass = "text-xs font-semibold hover:underline disabled:opacity-50";

// Detail Struk, opened from a nota of the Per Struk history and laid out like
// the struk itself: the toko, then each barang bought with its qty × harga and
// jumlah, the subtotal, ongkir / diskon / PPN, the TOTAL, and how it was paid.
// Under each barang, Riwayat opens it across every nota (stok, COGS, riwayat,
// log); admins also change (Ubah) or delete (Hapus) the line. Escape or a
// backdrop click closes it.
const PurchaseNotaDialog = ({
  nota,
  isAdmin,
  onClose,
  onOpenItem,
  onEditItem,
  onDeleteItem,
  isDeleting,
  onOpenReceipts,
  showUnits = true,
}) => {
  const extras = notaFooterLines(nota);
  // Barang Lainnya (showUnits false) are counted per piece.
  const quantityOf = (item) =>
    showUnits
      ? packedQuantityLabel(item.quantity, item.unit, item.packSize, item.packUnit || item.stockUnit)
      : quantityDisplay(item.quantity, "");

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3"
      role="dialog"
      aria-modal="true"
      aria-label={`Detail Struk #${nota.id} ${nota.supplierName}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {/* As wide as the barang detail (PurchaseHistoryDialog). */}
      <div className="max-h-[88vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-[#1f1f1f] p-5 text-[#f5f5f5] shadow-xl">
        <div className="rounded-lg bg-[#181818] px-5 py-6 text-sm tabular-nums">
          <div className="text-center">
            <h2 className="text-lg font-bold">{nota.supplierName}</h2>
            <p className="mt-1 text-xs text-[#ababab]">
              {formatDayMonthYear(nota.date)} · Nota #{nota.id}
            </p>
          </div>

          <ul aria-label="Daftar barang" className="mt-4 border-t border-dashed border-[#555] pt-3">
            {nota.items.map((item) => (
              <li key={item.id} className="py-2">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-semibold">{item.itemName}</span>
                  <span className="whitespace-nowrap font-semibold">{currency(item.total)}</span>
                </div>
                <p className="text-xs text-[#ababab]">
                  {quantityOf(item)} × {currency(item.unitPrice)}
                </p>
                <div className="mt-1 flex gap-3">
                  <button
                    type="button"
                    onClick={() => onOpenItem(item)}
                    aria-label={`Riwayat ${item.itemName}`}
                    className={`${linkClass} text-[#d6c7ae]`}
                  >
                    Riwayat
                  </button>
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => onEditItem(item)}
                        aria-label={`Ubah ${item.itemName}`}
                        className={`${linkClass} text-[#ababab]`}
                      >
                        Ubah
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteItem(item)}
                        disabled={isDeleting}
                        aria-label={`Hapus ${item.itemName}`}
                        className={`${linkClass} text-red-300`}
                      >
                        Hapus
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
            {!nota.items.length && (
              <li className="py-2 text-center text-[#ababab]">Semua barang nota ini sudah dihapus.</li>
            )}
          </ul>

          <dl className="mt-2 space-y-1 border-t border-dashed border-[#555] pt-3">
            {extras.length > 0 && (
              <div className="flex justify-between gap-3 text-[#ababab]">
                <dt>Subtotal</dt>
                <dd>{currency(nota.subtotal)}</dd>
              </div>
            )}
            {extras.map((line) => (
              <div key={line.key} className="flex justify-between gap-3 text-[#ababab]">
                <dt>{line.label}</dt>
                <dd className={line.amount < 0 ? "text-green-400" : ""}>{signedCurrency(line.amount)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-3 border-t border-[#444] pt-2 text-base font-bold">
              <dt>TOTAL</dt>
              <dd className="text-[#f6d365]">{currency(nota.total)}</dd>
            </div>
          </dl>

          <div className="mt-3 space-y-1 border-t border-dashed border-[#555] pt-3 text-xs text-[#ababab]">
            <p>
              Dibayar dari <span className="font-semibold text-[#f5f5f5]">{nota.paymentMethod || "-"}</span>
            </p>
            {(nota.createdBy || nota.postedBy) && (
              <p>
                {[nota.createdBy && `Dibuat ${nota.createdBy}`, nota.postedBy && `Diposting ${nota.postedBy}`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {nota.note && <p>Catatan: {nota.note}</p>}
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          {(isAdmin || nota.attachments.length > 0) && (
            <button
              type="button"
              onClick={() => onOpenReceipts(nota.id)}
              className="rounded-lg border border-[#a79981]/40 px-4 py-2 text-sm font-semibold text-[#d6c7ae] hover:bg-[#a79981]/10"
            >
              {nota.attachments.length ? `Bukti (${nota.attachments.length})` : "+ Bukti"}
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default PurchaseNotaDialog;
