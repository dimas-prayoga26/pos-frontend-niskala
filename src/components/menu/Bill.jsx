import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getTotalPrice } from "../../redux/slices/cartSlice";
import {
  addOrder,
  createMidtransTransaction,
  verifyMidtransPayment,
} from "../../https/index";
import { enqueueSnackbar } from "notistack";
import { useMutation } from "@tanstack/react-query";
import { removeAllItems } from "../../redux/slices/cartSlice";
import { removeCustomer, setCustomer } from "../../redux/slices/customerSlice";
import Invoice from "../invoice/Invoice";
import { formatCurrency } from "../../utils";
import receiptLogo from "../../../../assets/logo1.png";

const ONLINE_ORDER_RATE = 20;

function loadMidtransScript(clientKey) {
  return new Promise((resolve) => {
    if (window.snap) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://app.sandbox.midtrans.com/snap/snap.js";
    script.setAttribute("data-client-key", clientKey);
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const Bill = () => {
  const dispatch = useDispatch();

  const customerData = useSelector((state) => state.customer);
  const cartData = useSelector((state) => state.cart);
  const total = useSelector(getTotalPrice);
  const taxRate = 11;
  const orderType = customerData.orderType || "Offline";
  const onlineOrderCharge = 0;
  const taxableTotal = total + onlineOrderCharge;
  const tax = (taxableTotal * taxRate) / 100;
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
  const [showInvoice, setShowInvoice] = useState(false);
  const [orderInfo, setOrderInfo] = useState();

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

  const buildOrderData = (paymentData) => ({
    customerDetails: {
      name: getCustomerName(),
      guests: customerData.guests || 1,
    },
    orderType,
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
    paymentMethod: paymentMethod,
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

    if (isCateringOrder && cateringDp > totalPriceWithTax) {
      enqueueSnackbar("DP tidak boleh lebih besar dari total order.", {
        variant: "warning",
      });
      return;
    }

    if (paymentMethod === "Non Tunai") {
      try {
        const clientKey = import.meta.env.VITE_MIDTRANS_CLIENT_KEY;

        if (!clientKey) {
          enqueueSnackbar("Midtrans client key is not configured.", {
            variant: "warning",
          });
          return;
        }

        const scriptLoaded = await loadMidtransScript(clientKey);

        if (!scriptLoaded) {
          enqueueSnackbar("Midtrans SDK failed to load. Are you online?", {
            variant: "warning",
          });
          return;
        }

        const reqData = {
          amount: totalPriceWithTax,
          customerDetails: {
            name: getCustomerName(),
          },
        };

        const { data } = await createMidtransTransaction(reqData);

        window.snap.pay(data.transaction.token, {
          onSuccess: async function (response) {
            try {
              const verification = await verifyMidtransPayment({
                order_id: response.order_id,
              });

              enqueueSnackbar(verification.data.message, {
                variant: "success",
              });

              const orderData = buildOrderData({
                midtrans_order_id: response.order_id,
                midtrans_transaction_id: response.transaction_id,
                midtrans_payment_type: response.payment_type,
                midtrans_transaction_status: response.transaction_status,
              });

              orderMutation.mutate(orderData);
            } catch (error) {
              console.log(error);
              enqueueSnackbar("Payment verification failed!", {
                variant: "error",
              });
            }
          },
          onPending: function () {
            enqueueSnackbar("Payment is pending.", {
              variant: "warning",
            });
          },
          onError: function () {
            enqueueSnackbar("Payment failed!", {
              variant: "error",
            });
          },
          onClose: function () {
            enqueueSnackbar("Payment popup closed.", {
              variant: "info",
            });
          },
        });
      } catch (error) {
        console.log(error);
        enqueueSnackbar("Payment Failed!", {
          variant: "error",
        });
      }
    } else {
      orderMutation.mutate(buildOrderData());
    }
  };

  const orderMutation = useMutation({
    mutationFn: (reqData) => addOrder(reqData),
    onSuccess: (resData) => {
      const { data } = resData.data;
      console.log(data);

      setOrderInfo(data);

      enqueueSnackbar("Order Placed!", {
        variant: "success",
      });
      setShowInvoice(true);
      dispatch(removeCustomer());
      dispatch(removeAllItems());
    },
    onError: (error) => {
      console.log(error);
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
    const formatReceiptDate = (value) => {
      if (!value) return "-";

      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;

      return date.toLocaleDateString("id-ID");
    };

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
          ? `<div class="line-note">Variant: ${escapeHtml(item.variant)}</div>`
          : "";

        return `
          <div class="item">
            <div class="item-main">
              <span>${escapeHtml(item.name)}</span>
              <strong>${formatCurrency(item.price)}</strong>
            </div>
            <div class="line-note">Qty: ${item.quantity}</div>
              ${addOnsText}
              ${variantText}
          </div>
        `;
      })
      .join("");

    const printWindow = window.open("", "_blank", "width=420,height=720");

    if (!printWindow) {
      enqueueSnackbar("Popup blocked. Please allow popups to print receipt.", {
        variant: "warning",
      });
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Order Receipt</title>
          <style>
            * { box-sizing: border-box; }
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              color: #171717;
              background: #fff;
              font-family: "Courier New", monospace;
              font-size: 12px;
            }
            .receipt {
              width: 72mm;
              margin: 0 auto;
              padding: 10px 8px 14px;
            }
            .center {
              text-align: center;
            }
            .logo {
              display: block;
              width: 118px;
              height: auto;
              margin: 0 auto 10px;
            }
            .receipt-title {
              margin: 0;
              color: #171717;
              font-size: 12px;
              font-weight: 700;
              text-align: center;
              text-transform: uppercase;
            }
            .muted,
            .line-note {
              color: #666;
              font-size: 11px;
            }
            .meta {
              border-top: 1px dashed #999;
              border-bottom: 1px dashed #999;
              margin: 10px 0;
              padding: 8px 0;
            }
            .meta-row,
            .total-row,
            .item-main {
              display: flex;
              justify-content: space-between;
              gap: 8px;
            }
            .item {
              border-bottom: 1px dotted #bbb;
              padding: 7px 0;
            }
            .item-main span {
              max-width: 42mm;
            }
            .totals {
              border-bottom: 1px dashed #999;
              padding: 8px 0;
            }
            .total-row {
              margin-top: 5px;
            }
            .grand {
              border-top: 1px dashed #999;
              font-size: 15px;
              font-weight: 700;
              margin-top: 8px;
              padding-top: 8px;
            }
            .footer {
              margin-top: 12px;
              text-align: center;
              font-size: 11px;
            }
            @media print {
              body { padding: 0; }
              .receipt { width: 72mm; }
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <img class="logo" src="${receiptLogo}" alt="Niskala Coffee logo" />
            <p class="receipt-title">Order Receipt</p>
            <div class="meta">
              <div class="meta-row"><span>Customer</span><strong>${escapeHtml(getCustomerName())}</strong></div>
              <div class="meta-row"><span>Date</span><strong>${new Date().toLocaleString("id-ID")}</strong></div>
              <div class="meta-row"><span>Payment</span><strong>${escapeHtml(paymentMethod || "-")}</strong></div>
              ${
                isCateringOrder
                  ? `<div class="meta-row"><span>Instansi</span><strong>${escapeHtml(customerData.catering?.institution || "-")}</strong></div>
                     <div class="meta-row"><span>WhatsApp</span><strong>${escapeHtml(customerData.catering?.whatsapp || "-")}</strong></div>
                     <div class="meta-row"><span>Tanggal Acara</span><strong>${escapeHtml(formatReceiptDate(customerData.catering?.eventDate))}</strong></div>
                     <div class="meta-row"><span>Jam Kirim</span><strong>${escapeHtml(customerData.catering?.deliveryTime || "-")}</strong></div>`
                  : ""
              }
            </div>
            <div>${receiptRows}</div>
            <div class="totals">
              <div class="total-row"><span>Subtotal</span><strong>${formatCurrency(total)}</strong></div>
              ${
                onlineOrderCharge > 0
                  ? `<div class="total-row"><span>Online (+${ONLINE_ORDER_RATE}%)</span><strong>${formatCurrency(onlineOrderCharge)}</strong></div>`
                  : ""
              }
              <div class="total-row"><span>Tax (${taxRate}%)</span><strong>${formatCurrency(tax)}</strong></div>
              <div class="total-row grand"><span>Total</span><span>${formatCurrency(totalPriceWithTax)}</span></div>
            </div>
            ${
              isCateringOrder && customerData.catering?.note
                ? `<div class="footer">Catatan: ${escapeHtml(customerData.catering.note)}</div>`
                : `<div class="footer">Thank you for your order</div>`
            }
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
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
        <p className="text-xs text-[#ababab] font-medium mt-2">Tax(11%)</p>
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
    </>
  );
};

export default Bill;
