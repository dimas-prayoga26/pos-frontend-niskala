/* eslint-disable react/prop-types */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  RECEIPT_PAPER_SIZES,
  getReceiptPaperWidth,
  setReceiptPaperWidth,
} from "../../utils/thermerReceipt";

const PAPER_WIDTHS = Object.keys(RECEIPT_PAPER_SIZES).map(Number);

// Asked on every Print: the paper in the printer (58 or 80 mm). The last one
// used on this device is highlighted.
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

// const { choosePaperWidth, paperDialog } = useReceiptPaperDialog();
// const paperWidth = await choosePaperWidth(); // 58, 80, or null when cancelled
// ...and render {paperDialog}.
export const useReceiptPaperDialog = () => {
  const [lastWidth, setLastWidth] = useState(null);
  const resolveRef = useRef(null);

  const choosePaperWidth = useCallback(() => {
    resolveRef.current?.(null);

    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setLastWidth(getReceiptPaperWidth());
    });
  }, []);

  const close = useCallback((width) => {
    if (width) setReceiptPaperWidth(width);
    resolveRef.current?.(width || null);
    resolveRef.current = null;
    setLastWidth(null);
  }, []);

  const cancel = useCallback(() => close(null), [close]);

  const paperDialog = lastWidth ? (
    <ReceiptPaperDialog lastWidth={lastWidth} onChoose={close} onCancel={cancel} />
  ) : null;

  return { choosePaperWidth, paperDialog };
};
