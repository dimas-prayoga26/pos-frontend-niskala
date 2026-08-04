import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getTotalPrice } from "../../redux/slices/cartSlice";
import { addOrder } from "../../https/index";
import { enqueueSnackbar } from "notistack";
import { useMutation } from "@tanstack/react-query";
import { removeAllItems } from "../../redux/slices/cartSlice";
import { removeCustomer, setCustomer } from "../../redux/slices/customerSlice";
import Invoice from "../invoice/Invoice";
import NonCashPaymentModal from "./NonCashPaymentModal";
import { MdWarningAmber } from "react-icons/md";
import {
  formatCurrency,
  formatJakartaReceiptDate,
  formatJakartaReceiptDateTime,
  formatReceiptCurrency,
} from "../../utils";
import { printReceiptDocument } from "../../utils/printReceipt";
import receiptMark from "../../../../assets/Vector.svg";

const ONLINE_ORDER_RATE = 20;

const getItemTaxRate = (item) => {
  const taxRate = Number(item.taxRate);

  return Number.isFinite(taxRate) && taxRate > 0 ? taxRate : 0;
};

const getTaxLabel = (cartData) => {
  const taxRates = [
    ...new Set(cartData.map((item) => getItemTaxRate(item))),
  ].sort((a, b) => a - b);

  if (taxRates.length === 0 || taxRates.every((rate) => rate === 0)) {
    return "Tax (0%)";
  }

  if (taxRates.length === 1) return `Tax (${taxRates[0]}%)`;

  return "Tax (Mixed)";
};

const formatStockAmount = (value, unit) =>
  `${Number(value || 0).toLocaleString("id-ID")} ${unit || ""}`.trim();

const getInsufficientStockItems = (error) =>
  error?.response?.status === 409
    ? error.response?.data?.details?.insufficientStock || []
    : [];

const Bill = () => {
  const dispatch = useDispatch();

  const customerData = useSelector((state) => state.customer);
  const cartData = useSelector((state) => state.cart);
  const total = useSelector(getTotalPrice);
  const orderType = customerData.orderType || "Offline";
  const onlineOrderCharge = 0;
  const taxableTotal = total + onlineOrderCharge;
  const tax = cartData.reduce(
    (sum, item) => sum + ((Number(item.price) || 0) * getItemTaxRate(item)) / 100,
    0
  );
  const taxLabel = getTaxLabel(cartData);
  const totalPriceWithTax = taxableTotal + tax;
  const isCateringOrder = cartData.some(
    (item) => item.categoryName === "Catering"
  );
  const showCateringPayment =
    isCateringOrder || customerData.selectedCategoryName === "Catering";
  const cateringPaymentPlan = customerData.catering?.paymentPlan || "Full";
  const isCateringDp = cateringPaymentPlan === "DP";
  const cateringDp = isCateringOrder && isCateringDp
    ? Math.max(Number(customerData.catering?.dp) || 0, 0)
    : 0;
  const remainingBalance =
    isCateringOrder && isCateringDp
      ? Math.max(totalPriceWithTax - cateringDp, 0)
      : 0;

  const [paymentMethod, setPaymentMethod] = useState();
  const [showNonCashPayment, setShowNonCashPayment] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [orderInfo, setOrderInfo] = useState();
  const [stockWarningItems, setStockWarningItems] = useState([]);
  const [pendingOrderData, setPendingOrderData] = useState(null);

  const getCustomerName = () => customerData.customerName?.trim() || "Guest";
  const updateCateringDp = (value) => {
    dispatch(
      setCustomer({
        catering: {
          dp: value,
        },
      })
    );
  };
  const updateCateringPaymentPlan = (paymentPlan) => {
    dispatch(
      setCustomer({
        catering: {
          paymentPlan,
          dp: paymentPlan === "Full" ? "" : customerData.catering?.dp || "",
        },
      })
    );
  };

  const buildOrderData = (paymentData, selectedPaymentMethod = paymentMethod) => ({
    customerDetails: {
      name: getCustomerName(),
      guests: customerData.guests || 1,
    },
    orderType,
    orderPlatform: customerData.orderPlatform || "",
    orderStatus: "In Progress",
    bills: {
      total: total,
      onlineOrderCharge,
      tax: tax,
      totalWithTax: totalPriceWithTax,
      dp: cateringDp,
      remainingBalance,
    },
    items: cartData,
    paymentMethod: selectedPaymentMethod,
    paymentData,
    cateringDetails: isCateringOrder
      ? {
          institution: customerData.catering?.institution || "",
          whatsapp: customerData.catering?.whatsapp || "",
          orderDate: customerData.catering?.orderDate || "",
          eventDate: customerData.catering?.eventDate || "",
          deliveryTime: customerData.catering?.deliveryTime || "",
          paymentPlan: cateringPaymentPlan,
          dp: cateringDp,
          isPaid: !isCateringDp || cateringDp >= totalPriceWithTax,
          note: customerData.catering?.note || "",
        }
      : null,
  });

  const handlePlaceOrder = async () => {
    if (cartData.length === 0) {
      enqueueSnackbar("Please add at least one menu item!", {
        variant: "warning",
      });
      return;
    }

    if (!paymentMethod) {
      enqueueSnackbar("Please select a payment method!", {
        variant: "warning",
      });

      return;
    }

    if (orderType === "Online" && !customerData.orderPlatform) {
      enqueueSnackbar("Please select online order platform!", {
        variant: "warning",
      });
      return;
    }

    if (isCateringOrder && cateringDp > totalPriceWithTax) {
      enqueueSnackbar("DP tidak boleh lebih besar dari total order.", {
        variant: "warning",
      });
      return;
    }

    if (paymentMethod === "Non Tunai") {
      setShowNonCashPayment(true);
    } else {
      orderMutation.mutate(buildOrderData());
    }
  };

  const handleConfirmNonCashPayment = (selectedPaymentMethod) => {
    orderMutation.mutate(
      buildOrderData(
        {
          manual_payment_type: selectedPaymentMethod,
          manual_payment_amount: totalPriceWithTax,
        },
        selectedPaymentMethod
      )
    );
  };

  const handleCancelStockWarning = () => {
    setStockWarningItems([]);
    setPendingOrderData(null);
    enqueueSnackbar("Order dibatalkan. Stok tidak dikurangi.", {
      variant: "warning",
    });
  };

  const handleContinueWithNegativeStock = () => {
    if (!pendingOrderData) return;

    const nextOrderData = {
      ...pendingOrderData,
      allowNegativeStock: true,
    };

    setStockWarningItems([]);
    setPendingOrderData(null);
    orderMutation.mutate(nextOrderData);
  };

  const orderMutation = useMutation({
    mutationFn: (reqData) => addOrder(reqData),
    onSuccess: (resData) => {
      const { data } = resData.data;
      console.log(data);

      setOrderInfo(data);
      setShowNonCashPayment(false);

      enqueueSnackbar("Order Placed!", {
        variant: "success",
      });
      setShowInvoice(true);
      dispatch(removeCustomer());
      dispatch(removeAllItems());
    },
    onError: (error, variables) => {
      const insufficientStockItems = getInsufficientStockItems(error);

      if (insufficientStockItems.length && !variables?.allowNegativeStock) {
        setShowNonCashPayment(false);
        setPendingOrderData(variables);
        setStockWarningItems(insufficientStockItems);
        return;
      }

      console.log(error);
      enqueueSnackbar(
        error?.response?.data?.message || "Gagal membuat order.",
        { variant: "error" }
      );
    },
  });

  const handlePrintReceipt = () => {
    const escapeHtml = (value) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    if (cartData.length === 0) {
      enqueueSnackbar("Please add at least one menu item before printing!", {
        variant: "warning",
      });
      return;
    }

    const receiptRows = cartData
      .map((item) => {
        const addOnsText = item.addOns?.length
          ? `<div class="line-note">Add-ons: ${item.addOns
              .map((addOn) => escapeHtml(addOn.name))
              .join(", ")}</div>`
          : "";
        const variantText = item.variant
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
              ${addOnsText}
              ${variantText}
          </div>
        `;
      })
      .join("");

    const didOpenPrintWindow = printReceiptDocument({
      documentHtml: `
        <html>
          <head>
            <title>Order Receipt</title>
            <style>
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
              .center {
                text-align: center;
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
              .muted,
              .line-note {
                color: #000;
                font-size: 6px;
                font-weight: 900;
              }
              .meta {
                border-top: 1px dashed #000;
                border-bottom: 1px dashed #000;
                margin: 7px 0;
                padding: 6px 0;
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
                white-space: nowrap;
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
              @media print {
                body { padding: 0; }
                .receipt { width: 44mm; }
              }
            </style>
          </head>
          <body>
            <div class="receipt">
              <div class="brand">
                <img class="logo-mark" src="${receiptMark}" alt="Niskala Coffee mark" />
                <div class="brand-name">NISKALA</div>
                <div class="brand-subtitle">COFFEE</div>
              </div>
              <p class="receipt-title">Order Receipt</p>
              <div class="meta">
                <div class="meta-row"><span>Customer</span><strong>${escapeHtml(getCustomerName())}</strong></div>
                <div class="meta-row"><span>Date</span><strong>${formatJakartaReceiptDateTime()}</strong></div>
                <div class="meta-row"><span>Payment</span><strong>${escapeHtml(paymentMethod || "-")}</strong></div>
                ${
                  orderType === "Online"
                    ? `<div class="meta-row"><span>Platform</span><strong>${escapeHtml(customerData.orderPlatform || "-")}</strong></div>`
                    : ""
                }
                ${
                  isCateringOrder
                    ? `<div class="meta-row"><span>Instansi</span><strong>${escapeHtml(customerData.catering?.institution || "-")}</strong></div>
                       <div class="meta-row"><span>WhatsApp</span><strong>${escapeHtml(customerData.catering?.whatsapp || "-")}</strong></div>
                       <div class="meta-row"><span>Tgl Acara</span><strong>${escapeHtml(formatJakartaReceiptDate(customerData.catering?.eventDate))}</strong></div>
                       <div class="meta-row"><span>Jam Kirim</span><strong>${escapeHtml(customerData.catering?.deliveryTime || "-")}</strong></div>`
                    : ""
                }
              </div>
              <div>${receiptRows}</div>
              <div class="totals">
                <div class="total-block"><span>Subtotal</span><strong>${formatReceiptCurrency(total)}</strong></div>
                ${
                  onlineOrderCharge > 0
                    ? `<div class="total-block"><span>Online (+${ONLINE_ORDER_RATE}%)</span><strong>${formatReceiptCurrency(onlineOrderCharge)}</strong></div>`
                    : ""
                }
                <div class="total-block"><span>${taxLabel}</span><strong>${formatReceiptCurrency(tax)}</strong></div>
                <div class="total-block grand"><span>Total</span><strong>${formatReceiptCurrency(totalPriceWithTax)}</strong></div>
              </div>
              ${
                isCateringOrder && customerData.catering?.note
                  ? `<div class="footer">Catatan: ${escapeHtml(customerData.catering.note)}</div>`
                  : `<div class="footer">Thank you for your order</div>`
              }
            </div>
          </body>
        </html>
      `,
    });

    if (!didOpenPrintWindow) {
      enqueueSnackbar("Popup blocked. Please allow popups to print receipt.", {
        variant: "warning",
      });
      return;
    }
  };

  return (
    <>
      <div className="flex items-center justify-between px-5 mt-2">
        <p className="text-xs text-[#ababab] font-medium mt-2">
          Items({cartData.length})
        </p>
        <h1 className="text-[#f5f5f5] text-md font-bold">
          {formatCurrency(total)}
        </h1>
      </div>
      {onlineOrderCharge > 0 && (
        <div className="flex items-center justify-between px-5 mt-2">
          <p className="text-xs text-[#ababab] font-medium mt-2">
            Online (+20%)
          </p>
          <h1 className="text-[#f5f5f5] text-md font-bold">
            {formatCurrency(onlineOrderCharge)}
          </h1>
        </div>
      )}
      <div className="flex items-center justify-between px-5 mt-2">
        <p className="text-xs text-[#ababab] font-medium mt-2">{taxLabel}</p>
        <h1 className="text-[#f5f5f5] text-md font-bold">
          {formatCurrency(tax)}
        </h1>
      </div>
      <div className="flex items-center justify-between px-5 mt-2">
        <p className="text-xs text-[#ababab] font-medium mt-2">
          Total With Tax
        </p>
        <h1 className="text-[#f5f5f5] text-md font-bold">
          {formatCurrency(totalPriceWithTax)}
        </h1>
      </div>
      {showCateringPayment && (
        <div className="px-5 mt-3">
          <label className="block text-[#ababab] mb-2 text-xs font-medium">
            Pembayaran Catering
          </label>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={() => updateCateringPaymentPlan("Full")}
              className={`bg-[#1f1f1f] px-4 py-3 w-full rounded-lg text-[#ababab] font-semibold ${
                cateringPaymentPlan === "Full" ? "bg-[#383737]" : ""
              }`}
            >
              Bayar Full
            </button>
            <button
              onClick={() => updateCateringPaymentPlan("DP")}
              className={`bg-[#1f1f1f] px-4 py-3 w-full rounded-lg text-[#ababab] font-semibold ${
                cateringPaymentPlan === "DP" ? "bg-[#383737]" : ""
              }`}
            >
              DP
            </button>
          </div>
          {isCateringDp && (
            <div className="mt-3">
              <label className="block text-[#ababab] mb-2 text-xs font-medium">
                Nominal DP (Rp)
              </label>
              <input
                value={customerData.catering?.dp || ""}
                onChange={(event) => updateCateringDp(event.target.value)}
                type="number"
                min="0"
                placeholder="0"
                className="w-full rounded-lg bg-[#1f1f1f] px-4 py-3 text-sm text-white outline-none"
              />
            </div>
          )}
        </div>
      )}
      {isCateringOrder && isCateringDp && (
        <>
          <div className="flex items-center justify-between px-5 mt-2">
            <p className="text-xs text-[#ababab] font-medium mt-2">
              DP Catering
            </p>
            <h1 className="text-[#f5f5f5] text-md font-bold">
              {formatCurrency(cateringDp)}
            </h1>
          </div>
        </>
      )}
      <div className="flex flex-col sm:flex-row items-center gap-3 px-5 mt-4">
        <button
          onClick={() => setPaymentMethod("Tunai")}
          className={`bg-[#1f1f1f] px-4 py-3 w-full rounded-lg text-[#ababab] font-semibold ${
            paymentMethod === "Tunai" ? "bg-[#383737]" : ""
          }`}
        >
          Tunai
        </button>
        <button
          onClick={() => setPaymentMethod("Non Tunai")}
          className={`bg-[#1f1f1f] px-4 py-3 w-full rounded-lg text-[#ababab] font-semibold ${
            paymentMethod === "Non Tunai" ? "bg-[#383737]" : ""
          }`}
        >
          Non Tunai
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 px-5 mt-4 pb-4">
        <button
          onClick={handlePrintReceipt}
          className="bg-[#025cca] px-4 py-3 w-full rounded-lg text-[#f5f5f5] font-semibold text-lg"
        >
          Print Receipt
        </button>
        <button
          onClick={handlePlaceOrder}
          className="bg-[#a79981] px-4 py-3 w-full rounded-lg text-[#101010] font-semibold text-lg"
        >
          Place Order
        </button>
      </div>

      {showInvoice && (
        <Invoice orderInfo={orderInfo} setShowInvoice={setShowInvoice} />
      )}
      {showNonCashPayment && (
        <NonCashPaymentModal
          amount={totalPriceWithTax}
          customerName={getCustomerName()}
          isSubmitting={orderMutation.isPending}
          onClose={() => setShowNonCashPayment(false)}
          onConfirm={handleConfirmNonCashPayment}
        />
      )}
      {stockWarningItems.length > 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-lg border border-[#3f372c] bg-[#1f1f1f] text-[#f5f5f5] shadow-2xl shadow-black/70">
            <div className="flex items-start gap-3 border-b border-[#333] p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#a79981] text-[#101010]">
                <MdWarningAmber size={26} />
              </div>
              <div>
                <h2 className="text-lg font-bold">Stok Bahan Kurang</h2>
                <p className="mt-1 text-sm leading-6 text-[#ababab]">
                  Beberapa bahan tidak mencukupi untuk pesanan ini. Periksa
                  detailnya sebelum melanjutkan.
                </p>
              </div>
            </div>

            <div className="max-h-[45vh] space-y-3 overflow-y-auto p-5">
              {stockWarningItems.map((item) => (
                <div
                  key={`${item.name}-${item.unit}`}
                  className="rounded-lg border border-[#333] bg-[#171717] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 flex-1 [overflow-wrap:anywhere] text-base font-bold">
                      {item.name}
                    </h3>
                    <span className="rounded-md bg-[#3f251f] px-2 py-1 text-xs font-bold text-[#ffb19f]">
                      Kurang {formatStockAmount(item.shortage, item.unit)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md bg-[#202020] p-3">
                      <p className="text-xs font-semibold uppercase text-[#8d8d8d]">
                        Stok Saat Ini
                      </p>
                      <p className="mt-1 font-bold">
                        {formatStockAmount(item.stock, item.unit)}
                      </p>
                    </div>
                    <div className="rounded-md bg-[#202020] p-3">
                      <p className="text-xs font-semibold uppercase text-[#8d8d8d]">
                        Dibutuhkan
                      </p>
                      <p className="mt-1 font-bold">
                        {formatStockAmount(item.required, item.unit)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-[#333] p-5">
              <p className="mb-4 text-sm leading-6 text-[#ababab]">
                Jika dilanjutkan, stok bahan akan menjadi minus sesuai
                kekurangan di atas.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleCancelStockWarning}
                  disabled={orderMutation.isPending}
                  className="rounded-lg bg-[#2a2a2a] px-4 py-3 text-sm font-bold text-[#ababab] transition hover:bg-[#333] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Batalkan
                </button>
                <button
                  type="button"
                  onClick={handleContinueWithNegativeStock}
                  disabled={orderMutation.isPending}
                  className="rounded-lg bg-[#a79981] px-4 py-3 text-sm font-bold text-[#101010] transition hover:bg-[#b9aa91] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Lanjutkan Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Bill;
