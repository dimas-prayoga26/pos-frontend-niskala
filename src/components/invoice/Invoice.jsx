/* eslint-disable react/prop-types */
import { useRef } from "react";
import { enqueueSnackbar } from "notistack";
import { createDraftThermalPrintUrl, createThermalPrintUrl } from "../../https";
import { formatCurrency } from "../../utils";
import {
  isAndroidDevice,
  openBluetoothPrintApp,
  printReceiptDocument,
} from "../../utils/printReceipt";
import {
  buildReceiptPrintHtml,
  buildThermerReceiptEntries,
  getReceiptPaperWidth,
} from "../../utils/thermerReceipt";
import receiptMark from "../../../../assets/Vector.svg";
import { useReceiptPaperDialog } from "./ReceiptPaperDialog";

// Laptop / PC: the same receipt template as Thermer, through Chrome's print dialog.
const printReceiptWithBrowser = (orderInfo, paperWidth) =>
  printReceiptDocument({
    documentHtml: buildReceiptPrintHtml(orderInfo, {
      logoBaseUrl: window.location.origin,
      paperWidth,
    }),
  });

// paperWidth: 58 or 80 mm, picked in the dialog that opens on Print
// (useReceiptPaperDialog); otherwise the last one used on this device.
export const printOrderReceipt = async (
  orderInfo,
  { isDraft = false, paperWidth = getReceiptPaperWidth() } = {}
) => {
  if (!isAndroidDevice()) {
    return printReceiptWithBrowser(orderInfo, paperWidth);
  }

  try {
    const numericOrderId = orderInfo.id || orderInfo._id;

    if (!isDraft && !numericOrderId) {
      throw new Error("Order ID tidak ditemukan untuk struk ini.");
    }

    // Text in the printer's own font: the same size on every device.
    const payload = buildThermerReceiptEntries(orderInfo, {
      logoBaseUrl: window.location.origin,
      paperWidth,
    });
    const response = isDraft
      ? await createDraftThermalPrintUrl({ payload })
      : await createThermalPrintUrl({ orderId: numericOrderId, payload });
    const responseUrl = response.data?.data?.url;

    if (!responseUrl) {
      throw new Error("URL thermal print gagal dibuat.");
    }

    const cleanupFallback = openBluetoothPrintApp({
      responseUrl,
      onFallback: () => {
        enqueueSnackbar(
          "Thermer belum terbuka. Izinkan pembukaan aplikasi di Chrome, lalu tekan Print Receipt lagi.",
          { variant: "warning" }
        );
      },
    });

    window.setTimeout(() => {
      cleanupFallback();
    }, 3200);

    return true;
  } catch (error) {
    enqueueSnackbar(
      error?.response?.data?.message || error?.message ||
        "Gagal menyiapkan struk Thermer. Coba cetak lagi.",
      { variant: "error" }
    );
    return false;
  }
};

const Invoice = ({ orderInfo, setShowInvoice }) => {
  const orderCode = orderInfo.orderId || orderInfo.orderCode || orderInfo.id;
  const isPrintingRef = useRef(false);
  const { choosePaperWidth, paperDialog } = useReceiptPaperDialog();

  const handlePrint = async () => {
    if (isPrintingRef.current) return;

    const paperWidth = await choosePaperWidth();
    if (!paperWidth) return;

    isPrintingRef.current = true;
    await printOrderReceipt(orderInfo, { paperWidth });
    window.setTimeout(() => {
      isPrintingRef.current = false;
    }, 3200);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      style={{ padding: 16 }}
    >
      {paperDialog}
      <div
        className="rounded-lg bg-white text-center shadow-2xl"
        style={{
          width: "min(92vw, 320px)",
          maxWidth: 320,
          padding: 18,
        }}
      >
        <div className="mb-3 flex justify-center" style={{ marginBottom: 12 }}>
          <div className="text-center">
            <img
              src={receiptMark}
              alt="Niskala Coffee mark"
              className="object-contain"
              style={{
                width: 34,
                height: "auto",
                display: "block",
                margin: "0 auto 4px",
              }}
            />
            <div style={{ fontFamily: "Georgia, serif", fontWeight: 700 }}>
              NISKALA
            </div>
            <div style={{ fontSize: 9, fontWeight: 700 }}>COFFEE</div>
          </div>
        </div>

        <div
          className="mx-auto mb-3 flex items-center justify-center rounded-full"
          style={{
            width: "fit-content",
            minHeight: 28,
            padding: "5px 12px",
            marginLeft: "auto",
            marginRight: "auto",
            marginBottom: 12,
            backgroundColor: "#f3eee4",
            border: "1px solid #d9cdb8",
            color: "#7d6f59",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.2,
          }}
        >
          Order placed
        </div>

        <h2 className="text-lg font-bold text-[#171717]" style={{ fontSize: 18 }}>
          Order Successful
        </h2>
        <p className="mt-1 text-sm text-gray-500" style={{ fontSize: 13 }}>
          Pesanan berhasil dibuat.
        </p>

        <div
          className="mt-4 rounded-lg bg-gray-50 p-3 text-left text-sm text-gray-700"
          style={{ marginTop: 14, padding: 12, fontSize: 13 }}
        >
          <div className="flex justify-between gap-3">
            <span>Order ID</span>
            <strong>{orderCode}</strong>
          </div>
          <div className="mt-2 flex justify-between gap-3">
            <span>Total</span>
            <strong>{formatCurrency(orderInfo.bills.totalWithTax)}</strong>
          </div>
        </div>

        <div className="mt-4 flex gap-3" style={{ marginTop: 14, gap: 10 }}>
          <button
            onClick={handlePrint}
            className="w-full rounded-lg bg-[#a79981] px-4 py-2 text-sm font-semibold text-[#101010]"
          >
            Print Receipt
          </button>
          <button
            onClick={() => setShowInvoice(false)}
            className="w-full rounded-lg bg-[#eeeeee] px-4 py-2 text-sm font-semibold text-[#333333]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default Invoice;
