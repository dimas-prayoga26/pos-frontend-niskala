import { useEffect } from "react";
import { RECEIPT_PAPER_SIZES } from "../../utils/thermerReceipt";

const PAPER_WIDTHS = Object.keys(RECEIPT_PAPER_SIZES).map(Number);

// Asked on every Print: the paper in the printer (58 or 80 mm). The last one
// used on this device is highlighted. Opened by useReceiptPaperDialog.
const ReceiptPaperDialog = ({ lastWidth, onChoose, onCancel }) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onCancel();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-paper-title"
        className="w-full max-w-xs rounded-lg bg-[#1f1f1f] p-5 text-[#f5f5f5] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="receipt-paper-title" className="text-lg font-bold">
          Ukuran Kertas Struk
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {PAPER_WIDTHS.map((width) => (
            <button
              key={width}
              type="button"
              autoFocus={width === lastWidth}
              onClick={() => onChoose(width)}
              className={`rounded-lg px-4 py-4 text-lg font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6c7ae] ${
                width === lastWidth
                  ? "bg-[#a79981] text-[#101010] hover:bg-[#b9aa91]"
                  : "bg-[#2a2a2a] text-[#f5f5f5] hover:bg-[#333]"
              }`}
            >
              {width} mm
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="mt-4 w-full rounded-lg bg-[#2a2a2a] px-4 py-2 text-sm font-semibold text-[#ababab] hover:text-white"
        >
          Batal
        </button>
      </div>
    </div>
  );
};

export default ReceiptPaperDialog;
