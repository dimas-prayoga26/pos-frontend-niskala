import { enqueueSnackbar } from "notistack";
import { createThermalPrintUrl } from "../../https";
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

// Printing a saved order from Invoice or OrderCard.
// Its own module so Invoice.jsx exports only its component (Fast Refresh).

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
  { paperWidth = getReceiptPaperWidth() } = {}
) => {
  if (!isAndroidDevice()) {
    return printReceiptWithBrowser(orderInfo, paperWidth);
  }

  try {
    const numericOrderId = orderInfo.id || orderInfo._id;

    if (!numericOrderId) {
      throw new Error("Order ID tidak ditemukan untuk struk ini.");
    }

    // Text in the printer's own font: the same size on every device.
    const payload = buildThermerReceiptEntries(orderInfo, {
      logoBaseUrl: window.location.origin,
      paperWidth,
    });
    const response = await createThermalPrintUrl({ orderId: numericOrderId, payload });
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
