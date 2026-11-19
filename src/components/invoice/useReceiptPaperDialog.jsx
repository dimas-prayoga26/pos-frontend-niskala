import { useCallback, useRef, useState } from "react";
import { getReceiptPaperWidth, setReceiptPaperWidth } from "../../utils/thermerReceipt";
import ReceiptPaperDialog from "./ReceiptPaperDialog";

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
