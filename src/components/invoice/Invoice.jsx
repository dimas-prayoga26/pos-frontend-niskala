/* eslint-disable react/prop-types */
import { useRef } from "react";
import { enqueueSnackbar } from "notistack";
import { createThermalPrintUrl } from "../../https";
import {
  formatCurrency,
  formatJakartaReceiptDate,
  formatJakartaReceiptDateTime,
  formatReceiptCurrency,
} from "../../utils";
import {
  isAndroidDevice,
  openBluetoothPrintApp,
  printReceiptDocument,
} from "../../utils/printReceipt";
import receiptMark from "../../../../assets/Vector.svg";

const BLUETOOTH_RECEIPT_SCALE_STORAGE_KEY = "niskalaBluetoothReceiptScale";

const clampBluetoothReceiptScale = (value) => {
  const scale = Number(value);

  if (!Number.isFinite(scale)) return 1;

  return Math.min(1.35, Math.max(0.85, scale));
};

const getBluetoothReceiptScale = () => {
  try {
    const queryScale = new URLSearchParams(window.location.search).get(
      "receiptScale"
    );

    if (queryScale) {
      const clampedQueryScale = clampBluetoothReceiptScale(queryScale);
      window.localStorage.setItem(
        BLUETOOTH_RECEIPT_SCALE_STORAGE_KEY,
        String(clampedQueryScale)
      );

      return clampedQueryScale;
    }

    const storedScale = window.localStorage.getItem(
      BLUETOOTH_RECEIPT_SCALE_STORAGE_KEY
    );

    if (storedScale) {
      return clampBluetoothReceiptScale(storedScale);
    }
  } catch {
    return 1;
  }

  return 1;
};

const buildReceiptHtml = (orderInfo, { logoSrc = receiptMark } = {}) => {
  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const orderCode = orderInfo.orderId || orderInfo.orderCode || orderInfo.id;
  const onlineOrderCharge = Number(orderInfo.bills.onlineOrderCharge) || 0;
  const cateringDetails = orderInfo.cateringDetails;
  const receiptLine = (className = "") =>
    `<div class="receipt-separator${className ? ` ${className}` : ""}"><div class="receipt-line"></div></div>`;
  const getVariantParts = (variant) => {
    const parts = String(variant ?? "")
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);
    const temperatureIndex = parts.findIndex((part) =>
      /^(cold|hot|ice|iced|dingin|panas)$/i.test(part)
    );

    return {
      temperature: temperatureIndex >= 0 ? parts[temperatureIndex] : "",
      size: parts
        .filter((_, index) => index !== temperatureIndex)
        .join(" / "),
    };
  };

  const itemRows = orderInfo.items
    .map((item) => {
      const addOns = item.addOns?.length
        ? `<div class="line-note">Add-ons: ${item.addOns
            .map((addOn) => escapeHtml(addOn.name))
            .join(", ")}</div>`
        : "";
      const variantParts = getVariantParts(item.variant);
      const temperature = variantParts.temperature
        ? `<strong class="item-option">${escapeHtml(variantParts.temperature)}</strong>`
        : "";
      const size = variantParts.size
        ? `<div class="line-note item-size">Size: ${escapeHtml(variantParts.size)}</div>`
        : "";

      return `
        <div class="item">
          <div class="item-main">
            <span>${escapeHtml(item.name)}</span>
            ${temperature}
          </div>
          <div class="item-detail">
            <span class="line-note">Qty: ${item.quantity}</span>
            <strong>${formatReceiptCurrency(item.price)}</strong>
          </div>
          ${size}
          ${addOns}
        </div>
        ${receiptLine("item-separator")}
      `;
    })
    .join("");

  return `
    <div class="receipt">
      <div class="brand">
        <img class="logo-mark" src="${logoSrc}" alt="Niskala Coffee mark" />
        <div class="brand-name">NISKALA</div>
        <div class="brand-subtitle">COFFEE</div>
      </div>
      <p class="receipt-title">Order Receipt</p>

      ${receiptLine("title-separator")}
      <div class="meta">
        <div class="meta-row"><span>Order ID</span><strong>${escapeHtml(orderCode)}</strong></div>
        <div class="meta-row"><span>Customer</span><strong>${escapeHtml(orderInfo.customerDetails.name)}</strong></div>
        <div class="meta-row"><span>Date</span><strong>${formatJakartaReceiptDateTime(orderInfo.orderDate)}</strong></div>
        <div class="meta-row"><span>Payment</span><strong>${escapeHtml(orderInfo.paymentMethod || "-")}</strong></div>
        ${
          orderInfo.orderType === "Online"
            ? `<div class="meta-row"><span>Platform</span><strong>${escapeHtml(orderInfo.orderPlatform || "-")}</strong></div>`
            : ""
        }
        ${
          cateringDetails
            ? `<div class="meta-row"><span>Instansi</span><strong>${escapeHtml(cateringDetails.institution || "-")}</strong></div>
               <div class="meta-row"><span>WhatsApp</span><strong>${escapeHtml(cateringDetails.whatsapp || "-")}</strong></div>
               <div class="meta-row"><span>Tgl Acara</span><strong>${escapeHtml(formatJakartaReceiptDate(cateringDetails.eventDate))}</strong></div>
               <div class="meta-row"><span>Jam Kirim</span><strong>${escapeHtml(cateringDetails.deliveryTime || "-")}</strong></div>
               <div class="meta-row"><span>Status Bayar</span><strong>${cateringDetails.isPaid ? "Lunas" : "Belum Lunas"}</strong></div>`
            : ""
        }
      </div>
      ${receiptLine("meta-separator")}

      <div>${itemRows}</div>

      <div class="totals">
        <div class="total-block"><span>Subtotal</span><strong>${formatReceiptCurrency(orderInfo.bills.total)}</strong></div>
        ${
          onlineOrderCharge > 0
            ? `<div class="total-block"><span>Online (+20%)</span><strong>${formatReceiptCurrency(onlineOrderCharge)}</strong></div>`
            : ""
        }
        <div class="total-block"><span>Tax</span><strong>${formatReceiptCurrency(orderInfo.bills.tax)}</strong></div>
      </div>
      ${receiptLine("tax-separator")}
      <div class="receipt-grand-total">
        <div class="total-block grand"><span>Total</span><strong>${formatReceiptCurrency(orderInfo.bills.totalWithTax)}</strong></div>
      </div>
      ${receiptLine("total-separator")}

      <div class="footer">${
        cateringDetails?.note
          ? `Catatan: ${escapeHtml(cateringDetails.note)}`
          : "Thank you for your order"
      }</div>
    </div>
  `;
};

const receiptPrintStyle = `
  * { box-sizing: border-box; }
  @page {
    size: 58mm auto;
    margin: 0;
  }
  body {
    margin: 0;
    padding: 0;
    color: #000;
    background: #fff;
    font-family: "Arial Narrow", Arial, Helvetica, sans-serif;
    font-size: 7px;
    font-weight: 900;
    line-height: 1.28;
    letter-spacing: 0;
    text-rendering: geometricPrecision;
    -webkit-text-stroke: 0.06px #000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .receipt {
    width: 44mm;
    margin: 0 auto;
    padding: 5px 2mm 8px 0;
  }
  .receipt-separator {
    display: none;
  }
  .receipt-line {
    display: none;
  }
  .brand {
    text-align: center;
    margin-bottom: 5px;
  }
  .logo-mark {
    display: block;
    width: 24px;
    height: auto;
    margin: 0 auto 3px;
    filter: grayscale(1) contrast(400%) brightness(0);
    opacity: 1;
  }
  .brand-name {
    color: #000;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 12px;
    font-weight: 900;
    line-height: 1;
    text-transform: uppercase;
    -webkit-text-stroke: 0.06px #000;
  }
  .brand-subtitle {
    color: #000;
    font-size: 5px;
    font-weight: 900;
    line-height: 1.1;
    text-transform: uppercase;
  }
  .receipt-title {
    margin: 0;
    color: #000;
    font-size: 7px;
    font-weight: 900;
    text-align: center;
    text-transform: uppercase;
  }
  .meta {
    border-top: 1px dashed #000;
    border-bottom: 1px dashed #000;
    margin: 7px 0;
    padding: 6px 0;
  }
  .payment-meta {
    border-top: 0;
  }
  .meta-row,
  .item-main,
  .item-detail {
    display: flex;
    justify-content: flex-start;
    gap: 2px;
  }
  .meta-row span {
    display: inline-flex;
    flex: 0 0 16mm;
    justify-content: space-between;
    padding-right: 2mm;
  }
  .meta-row span::after {
    content: " :";
  }
  .meta-row + .meta-row {
    margin-top: 4px;
  }
  strong {
    color: #000;
    font-weight: 900;
    -webkit-text-stroke: 0.08px #000;
  }
  .item {
    border-bottom: 1px dotted #000;
    padding: 4px 0;
  }
  .item-main span {
    flex: 1 1 auto;
    max-width: 100%;
    overflow-wrap: anywhere;
  }
  .item-option {
    flex: 0 0 auto;
    margin-left: -120px;
    font-size: 6px;
    white-space: nowrap;
  }
  .item-detail strong,
  .total-block strong {
    display: block;
    color: #000;
    font-weight: 900;
    white-space: nowrap;
    overflow: visible;
    -webkit-text-stroke: 0.08px #000;
  }
  .item-detail {
    justify-content: space-between;
    margin-top: 2px;
  }
  .item-detail strong {
    flex: 0 0 auto;
    margin-left: 2mm;
    margin-right: 3mm;
    text-align: right;
    font-size: 7px;
  }
  .meta-row strong {
    flex: 1 1 auto;
    max-width: 29mm;
    text-align: left;
    overflow-wrap: anywhere;
  }
  .line-note {
    color: #000;
    font-size: 6px;
    font-weight: 900;
    margin-top: 2px;
  }
  .item-size {
    margin-top: 1px;
  }
  .totals {
    border-bottom: 1px dashed #000;
    padding: 6px 6mm;
  }
  .receipt-grand-total {
    border-bottom: 0;
    padding: 0 6mm 6px;
  }
  .total-block {
    display: flex;
    justify-content: space-between;
    gap: 2mm;
    width: 100%;
    margin-left: 0;
    margin-top: 5px;
    text-align: left;
  }
  .total-block strong {
    flex: 1 1 auto;
    text-align: right;
  }
  .grand {
    border-top: 1px dashed #000;
    font-size: 9px;
    font-weight: 900;
    margin-top: 6px;
    padding-top: 6px;
  }
  .footer {
    margin-top: 9px;
    text-align: center;
    font-size: 5px;
  }
`;

const bluetoothReceiptPrintStyle = `
  ${receiptPrintStyle}
  html,
  body {
    width: 219px !important;
    width: 58mm !important;
    min-width: 219px !important;
    min-width: 58mm !important;
    max-width: 219px !important;
    max-width: 58mm !important;
    height: auto !important;
    min-height: 0 !important;
    margin: 0 auto !important;
    padding: 0 !important;
    overflow: hidden !important;
    background: #fff !important;
    font-size: 6px !important;
    -webkit-text-size-adjust: 100% !important;
    text-size-adjust: 100% !important;
  }
  .bluetooth-print-page {
    width: 219px !important;
    width: 58mm !important;
    min-width: 219px !important;
    min-width: 58mm !important;
    max-width: 219px !important;
    max-width: 58mm !important;
    height: auto !important;
    min-height: 0 !important;
    margin: 0 auto !important;
    padding: 0 !important;
    overflow: hidden !important;
    background: #fff !important;
    font-size: 6px !important;
    line-height: 1.28 !important;
    -webkit-text-size-adjust: 100% !important;
    text-size-adjust: 100% !important;
  }
  .bluetooth-print-page * {
    -webkit-text-size-adjust: 100% !important;
    text-size-adjust: 100% !important;
  }
  .bluetooth-print-page .receipt {
    width: 166px !important;
    width: 44mm !important;
    max-width: 166px !important;
    max-width: 44mm !important;
    margin: 0 auto 0 0 !important;
    padding: 3px 4px 0 8px !important;
    overflow: visible !important;
    font-size: 6px !important;
    line-height: 1.28 !important;
    zoom: var(--receipt-device-scale, 1) !important;
  }
  .bluetooth-print-page .brand-name {
    font-size: 10px !important;
  }
  .bluetooth-print-page .brand-subtitle {
    font-size: 4px !important;
  }
  .bluetooth-print-page .receipt-title {
    font-size: 6px !important;
  }
  .bluetooth-print-page .line-note {
    font-size: 5px !important;
  }
  .bluetooth-print-page .item-option {
    margin-left: -120px !important;
    font-size: 5px !important;
    white-space: nowrap !important;
  }
  .bluetooth-print-page .brand,
  .bluetooth-print-page .receipt-title,
  .bluetooth-print-page .footer {
    width: 100% !important;
    text-align: center !important;
  }
  .bluetooth-print-page .logo-mark {
    margin-left: auto !important;
    margin-right: auto !important;
  }
  .bluetooth-print-page .brand {
    width: 110px !important;
    margin-left: 1px !important;
    margin-right: 0 !important;
    transform: none !important;
  }
  .bluetooth-print-page .brand {
    margin-bottom: 3px !important;
  }
  .bluetooth-print-page .receipt-title {
    width: 110px !important;
    margin: 0 0 4px 3px !important;
    transform: none !important;
  }
  .bluetooth-print-page .meta,
  .bluetooth-print-page .item {
    width: 160px !important;
    margin-left: auto !important;
    margin-right: auto !important;
    border-top: 0 !important;
    border-bottom: 0 !important;
  }
  .bluetooth-print-page .meta {
    padding: 3px 0 !important;
  }
  .bluetooth-print-page .item {
    padding: 2px 0 !important;
  }
  .bluetooth-print-page .receipt-separator {
    display: flex !important;
    justify-content: flex-start !important;
    width: 160px !important;
    height: auto !important;
    margin: 2px auto !important;
    padding: 0 !important;
    border: 0 !important;
  }
  .bluetooth-print-page .receipt-line {
    display: block !important;
    width: 100px !important;
    height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    border-bottom: 1px dashed #000 !important;
  }
  .bluetooth-print-page .item-separator {
    margin-top: 2px !important;
    margin-bottom: 2px !important;
  }
  .bluetooth-print-page .title-separator .receipt-line {
    width: 110px !important;
  }
  .bluetooth-print-page .meta-separator .receipt-line {
    width: 110px !important;
  }
  .bluetooth-print-page .item-separator .receipt-line {
    width: 110px !important;
  }
  .bluetooth-print-page .tax-separator {
    justify-content: flex-start !important;
    overflow: visible !important;
  }
  .bluetooth-print-page .tax-separator .receipt-line {
    width: 110px !important;
    margin-left: 1px !important;
    transform: none !important;
  }
  .bluetooth-print-page .total-separator {
    justify-content: flex-start !important;
    width: 160px !important;
    margin-left: auto !important;
    margin-right: auto !important;
    overflow: visible !important;
  }
  .bluetooth-print-page .total-separator .receipt-line {
    width: 110px !important;
    margin-left: 1px !important;
    transform: none !important;
  }
  .bluetooth-print-page .item-separator .receipt-line {
    border-bottom-style: dotted !important;
  }
  .bluetooth-print-page .meta-row span {
    flex: 0 0 58px !important;
    padding-right: 6px !important;
  }
  .bluetooth-print-page .meta-row + .meta-row {
    margin-top: 2px !important;
  }
  .bluetooth-print-page .meta-row strong {
    max-width: none !important;
    min-width: 0 !important;
  }
  .bluetooth-print-page .item-detail {
    align-items: baseline !important;
    display: grid !important;
    grid-template-columns: 56px 62px !important;
    justify-content: start !important;
    gap: 8px !important;
    width: 100% !important;
  }
  .bluetooth-print-page .item-detail strong {
    margin-left: 0 !important;
    margin-right: 18px !important;
    max-width: 78px !important;
    min-width: 0 !important;
    overflow: visible !important;
    text-align: left !important;
    white-space: nowrap !important;
    font-size: 6px !important;
  }
  .bluetooth-print-page .totals {
    display: grid !important;
    grid-template-columns: 48px 62px !important;
    column-gap: 8px !important;
    row-gap: 3px !important;
    width: 140px !important;
    margin-top: 2px !important;
    margin-left: auto !important;
    margin-right: auto !important;
    margin-bottom: 2px !important;
    padding: 2px 0 2px !important;
    border-bottom: 0 !important;
  }
  .bluetooth-print-page .totals .total-block {
    display: contents !important;
  }
  .bluetooth-print-page .totals .total-block span,
  .bluetooth-print-page .totals .total-block strong {
    margin-top: 0 !important;
    text-align: left !important;
  }
  .bluetooth-print-page .receipt-grand-total {
    width: 140px !important;
    margin-left: auto !important;
    margin-right: auto !important;
    padding: 0 0 2px !important;
    border-bottom: 0 !important;
  }
  .bluetooth-print-page .total-block {
    display: grid !important;
    grid-template-columns: 48px 63px !important;
    justify-content: start !important;
    gap: 8px !important;
    width: 100% !important;
    margin-left: 0 !important;
    margin-top: 3px !important;
  }
  .bluetooth-print-page .total-block strong {
    min-width: 0 !important;
    max-width: 62px !important;
    overflow: visible !important;
    text-align: left !important;
    white-space: nowrap !important;
    font-size: 6px !important;
  }
  .bluetooth-print-page .receipt-grand-total .total-block span {
    text-align: left !important;
  }
  .bluetooth-print-page .grand {
    position: relative !important;
    border-top: 0 !important;
    border-bottom: 0 !important;
    margin-top: 4px !important;
    margin-bottom: 4px !important;
    padding-top: 4px !important;
    padding-bottom: 0 !important;
    font-size: 7.5px !important;
  }
  .bluetooth-print-page .footer {
    display: block !important;
    width: 110px !important;
    margin-top: 5px !important;
    margin-left: 1px !important;
    margin-right: 0 !important;
    margin-bottom: 0 !important;
    padding-bottom: 0 !important;
    text-align: center !important;
    line-height: 1 !important;
    font-size: 4px !important;
  }
`;

const getAbsoluteAssetUrl = (assetUrl) => new URL(assetUrl, window.location.origin).href;

let receiptLogoDataUrlPromise;

const getReceiptLogoDataUrl = async () => {
  if (!receiptLogoDataUrlPromise) {
    receiptLogoDataUrlPromise = fetch(getAbsoluteAssetUrl(receiptMark))
      .then((response) => {
        if (!response.ok) {
          throw new Error("Logo receipt gagal dimuat.");
        }

        return response.text();
      })
      .then(
        (svgText) =>
          new Promise((resolve, reject) => {
            const blackSvgText = svgText.replace(
              /fill="(?!none")[^"]*"/g,
              'fill="#000000"'
            );
            const svgBlob = new Blob([blackSvgText], {
              type: "image/svg+xml;charset=utf-8",
            });
            const svgUrl = URL.createObjectURL(svgBlob);
            const image = new Image();

            image.onload = () => {
              const canvas = document.createElement("canvas");
              const size = 96;
              canvas.width = size;
              canvas.height = size;

              const context = canvas.getContext("2d");
              context.clearRect(0, 0, size, size);
              context.drawImage(image, 0, 0, size, size);
              URL.revokeObjectURL(svgUrl);
              resolve(canvas.toDataURL("image/png"));
            };

            image.onerror = () => {
              URL.revokeObjectURL(svgUrl);
              reject(new Error("Logo receipt gagal dikonversi."));
            };

            image.src = svgUrl;
          })
      );
  }

  return receiptLogoDataUrlPromise;
};

const buildBluetoothPrintPayload = async (orderInfo) => {
  const receiptScale = getBluetoothReceiptScale();

  return [
    {
      type: 4,
      content: [
        '<meta name="viewport" content="width=219, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no">',
        `<style>:root{--receipt-device-scale:${receiptScale};}${bluetoothReceiptPrintStyle}</style>`,
        '<div class="bluetooth-print-page">',
        buildReceiptHtml(orderInfo, {
          logoSrc: await getReceiptLogoDataUrl(),
        }),
        "</div>",
      ].join(""),
    },
  ];
};

const Invoice = ({ orderInfo, setShowInvoice }) => {
  const orderCode = orderInfo.orderId || orderInfo.orderCode || orderInfo.id;
  const isPrintingRef = useRef(false);

  const printWithExistingBehavior = () => {
    return printReceiptDocument({
      documentHtml: `
        <html>
          <head>
            <title>Order Receipt</title>
            <style>${receiptPrintStyle}</style>
          </head>
          <body>${buildReceiptHtml(orderInfo)}</body>
        </html>
      `,
    });
  };

  const handlePrint = async () => {
    if (isPrintingRef.current) return;

    if (!isAndroidDevice()) {
      printWithExistingBehavior();
      return;
    }

    isPrintingRef.current = true;

    try {
      const numericOrderId = orderInfo.id || orderInfo._id;

      if (!numericOrderId) {
        throw new Error("Order ID tidak ditemukan untuk struk ini.");
      }

      const response = await createThermalPrintUrl({
        orderId: numericOrderId,
        payload: await buildBluetoothPrintPayload(orderInfo),
      });
      const responseUrl = response.data?.data?.url;

      if (!responseUrl) {
        throw new Error("URL thermal print gagal dibuat.");
      }

      const cleanupFallback = openBluetoothPrintApp({
        responseUrl,
        onFallback: () => {
          enqueueSnackbar(
            "Bluetooth Print app tidak terbuka. Membuka struk dengan cara lama.",
            { variant: "warning" }
          );
          printWithExistingBehavior();
        },
      });

      window.setTimeout(() => {
        cleanupFallback();
        isPrintingRef.current = false;
      }, 3200);
    } catch (error) {
      enqueueSnackbar(
        error?.message ||
          "Gagal menyiapkan thermal print. Membuka struk dengan cara lama.",
        { variant: "error" }
      );
      printWithExistingBehavior();
      isPrintingRef.current = false;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      style={{ padding: 16 }}
    >
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
