import React from "react";
import { formatCurrency } from "../../utils";
import receiptLogo from "../../../../assets/logo1.png";

const buildReceiptHtml = (orderInfo) => {
  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const orderCode = orderInfo.orderId || orderInfo.orderCode || orderInfo.id;
  const orderDate = orderInfo.orderDate
    ? new Date(orderInfo.orderDate)
    : new Date();
  const onlineOrderCharge = Number(orderInfo.bills.onlineOrderCharge) || 0;
  const cateringDetails = orderInfo.cateringDetails;
  const formatReceiptDate = (value) => {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString("id-ID");
  };

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
            <strong>${formatCurrency(item.price)}</strong>
          </div>
          <div class="line-note">Qty: ${item.quantity}</div>
          ${variant}
          ${addOns}
        </div>
      `;
    })
    .join("");

  return `
    <div class="receipt">
      <img class="logo" src="${receiptLogo}" alt="Niskala Coffee logo" />
      <p class="receipt-title">Order Receipt</p>

      <div class="meta">
        <div class="meta-row"><span>Order ID</span><strong>${escapeHtml(orderCode)}</strong></div>
        <div class="meta-row"><span>Customer</span><strong>${escapeHtml(orderInfo.customerDetails.name)}</strong></div>
        <div class="meta-row"><span>Date</span><strong>${orderDate.toLocaleString("id-ID")}</strong></div>
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
               <div class="meta-row"><span>Tgl Acara</span><strong>${escapeHtml(formatReceiptDate(cateringDetails.eventDate))}</strong></div>
               <div class="meta-row"><span>Jam Kirim</span><strong>${escapeHtml(cateringDetails.deliveryTime || "-")}</strong></div>
               <div class="meta-row"><span>Status Bayar</span><strong>${cateringDetails.isPaid ? "Lunas" : "Belum Lunas"}</strong></div>`
            : ""
        }
      </div>

      <div>${itemRows}</div>

      <div class="totals">
        <div class="total-row"><span>Subtotal</span><strong>${formatCurrency(orderInfo.bills.total)}</strong></div>
        ${
          onlineOrderCharge > 0
            ? `<div class="total-row"><span>Online (+20%)</span><strong>${formatCurrency(onlineOrderCharge)}</strong></div>`
            : ""
        }
        <div class="total-row"><span>Tax</span><strong>${formatCurrency(orderInfo.bills.tax)}</strong></div>
        <div class="total-row grand"><span>Total</span><span>${formatCurrency(orderInfo.bills.totalWithTax)}</span></div>
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
    color: #171717;
    background: #fff;
    font-family: "Courier New", monospace;
    font-size: 10px;
  }
  .receipt {
    width: 58mm;
    margin: 0 auto;
    padding: 7px 4mm 10px;
  }
  .logo {
    display: block;
    width: 82px;
    height: auto;
    margin: 0 auto 7px;
  }
  .receipt-title {
    margin: 0;
    color: #171717;
    font-size: 10px;
    font-weight: 700;
    text-align: center;
    text-transform: uppercase;
  }
  .meta {
    border-top: 1px dashed #999;
    border-bottom: 1px dashed #999;
    margin: 7px 0;
    padding: 6px 0;
  }
  .payment-meta {
    border-top: 0;
  }
  .meta-row,
  .total-row,
  .item-main {
    display: flex;
    justify-content: space-between;
    gap: 5px;
  }
  .meta-row + .meta-row {
    margin-top: 4px;
  }
  .item {
    border-bottom: 1px dotted #bbb;
    padding: 5px 0;
  }
  .item-main span {
    max-width: 29mm;
    overflow-wrap: anywhere;
  }
  .line-note {
    color: #666;
    font-size: 9px;
    margin-top: 2px;
  }
  .totals {
    border-bottom: 1px dashed #999;
    padding: 6px 0;
  }
  .total-row {
    margin-top: 4px;
  }
  .grand {
    border-top: 1px dashed #999;
    font-size: 12px;
    font-weight: 700;
    margin-top: 6px;
    padding-top: 6px;
  }
  .footer {
    margin-top: 9px;
    text-align: center;
    font-size: 9px;
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
          <img
            src={receiptLogo}
            alt="Niskala Coffee logo"
            className="object-contain"
            style={{ width: 58, height: "auto", display: "block" }}
          />
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
