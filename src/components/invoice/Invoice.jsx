import React from "react";
import {
  formatCurrency,
  formatJakartaReceiptDate,
  formatJakartaReceiptDateTime,
  formatReceiptCurrency,
} from "../../utils";
import receiptMark from "../../../../assets/Vector.svg";

const buildReceiptHtml = (orderInfo) => {
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

  const itemRows = orderInfo.items
    .map((item) => {
      const addOns = item.addOns?.length
        ? `<div class="line-note">Add-ons: ${item.addOns
            .map((addOn) => escapeHtml(addOn.name))
            .join(", ")}</div>`
        : "";
      const variant = item.variant
        ? `<div class="line-note">Pilihan: ${escapeHtml(item.variant)}</div>`
        : "";

      return `
        <div class="item">
          <div class="item-main">
            <span>${escapeHtml(item.name)}</span>
          </div>
          <div class="item-detail">
            <span class="line-note">Qty: ${item.quantity}</span>
            <strong>${formatReceiptCurrency(item.price)}</strong>
          </div>
          ${variant}
          ${addOns}
        </div>
      `;
    })
    .join("");

  return `
    <div class="receipt">
      <div class="brand">
        <img class="logo-mark" src="${receiptMark}" alt="Niskala Coffee mark" />
        <div class="brand-name">NISKALA</div>
        <div class="brand-subtitle">COFFEE</div>
      </div>
      <p class="receipt-title">Order Receipt</p>

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

      <div>${itemRows}</div>

      <div class="totals">
        <div class="total-block"><span>Subtotal</span><strong>${formatReceiptCurrency(orderInfo.bills.total)}</strong></div>
        ${
          onlineOrderCharge > 0
            ? `<div class="total-block"><span>Online (+20%)</span><strong>${formatReceiptCurrency(onlineOrderCharge)}</strong></div>`
            : ""
        }
        <div class="total-block"><span>Tax</span><strong>${formatReceiptCurrency(orderInfo.bills.tax)}</strong></div>
        <div class="total-block grand"><span>Total</span><strong>${formatReceiptCurrency(orderInfo.bills.totalWithTax)}</strong></div>
      </div>

      ${
        orderInfo.paymentMethod === "Non Tunai"
          ? `<div class="meta payment-meta">
              <div class="meta-row"><span>Midtrans</span><strong>${escapeHtml(orderInfo.paymentData?.midtrans_order_id || "-")}</strong></div>
              <div class="meta-row"><span>Type</span><strong>${escapeHtml(orderInfo.paymentData?.midtrans_payment_type || "-")}</strong></div>
            </div>`
          : ""
      }

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
  .totals {
    border-bottom: 1px dashed #000;
    padding: 6px 6mm;
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

const Invoice = ({ orderInfo, setShowInvoice }) => {
  const orderCode = orderInfo.orderId || orderInfo.orderCode || orderInfo.id;

  const handlePrint = () => {
    const WinPrint = window.open("", "", "width=300,height=720");

    WinPrint.document.write(`
      <html>
        <head>
          <title>Order Receipt</title>
          <style>${receiptPrintStyle}</style>
        </head>
        <body>${buildReceiptHtml(orderInfo)}</body>
      </html>
    `);

    WinPrint.document.close();
    WinPrint.focus();
    setTimeout(() => {
      WinPrint.print();
      WinPrint.close();
    }, 300);
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
