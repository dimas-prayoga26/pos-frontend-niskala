import { useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getTotalDiscount, getTotalPrice } from "../../redux/slices/cartSlice";
import { addOrder } from "../../https/index";
import { enqueueSnackbar } from "notistack";
import { useMutation } from "@tanstack/react-query";
import { removeAllItems } from "../../redux/slices/cartSlice";
import { removeCustomer, setCustomer } from "../../redux/slices/customerSlice";
import Invoice, { printOrderReceipt } from "../invoice/Invoice";
import NonCashPaymentModal from "./NonCashPaymentModal";
import { useReceiptPaperDialog } from "../invoice/ReceiptPaperDialog";
import { hasMissingBundlePicks } from "../../features/pos/utils/bundleChoices";
import { MdWarningAmber } from "react-icons/md";
import { formatCurrency, normalizeNominalInput } from "../../utils";
import { isAndroidDevice } from "../../utils/printReceipt";

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

const getPlatformFeeLabel = () => "Biaya Platform";

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
  const totalDiscount = useSelector(getTotalDiscount);
  const orderType = customerData.orderType || "Offline";
  const onlineOrderCharge = 0;
  const taxableTotal = total + onlineOrderCharge;
  const itemTax = cartData.reduce(
    (sum, item) => sum + ((Number(item.price) || 0) * getItemTaxRate(item)) / 100,
    0
  );
  const rawPlatformFee = Number(normalizeNominalInput(customerData.platformTax)) || 0;
  const platformFee = orderType === "Online" ? Math.max(rawPlatformFee, 0) : 0;
  const tax = itemTax;
  const taxLabel = getTaxLabel(cartData);
  const totalPriceWithTax = Math.max(taxableTotal + tax - platformFee, 0);
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
  const isPrintingReceiptRef = useRef(false);
  const { choosePaperWidth, paperDialog } = useReceiptPaperDialog();
  const isSubmittingOrderRef = useRef(false);
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
      phone: orderType === "Offline" ? customerData.customerPhone?.trim() || "" : "",
    },
    orderType,
    orderDate: orderType === "Online" ? customerData.orderDate || "" : undefined,
    orderPlatformId: customerData.orderPlatformId || null,
    orderPlatform: customerData.orderPlatform || "",
    platformTax: platformFee,
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
    note: customerData.note || "",
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
    if (isSubmittingOrderRef.current || showNonCashPayment || stockWarningItems.length) return;
    if (cartData.length === 0) {
      enqueueSnackbar("Please add at least one menu item!", {
        variant: "warning",
      });
      return;
    }

    if (hasMissingBundlePicks(cartData)) {
      enqueueSnackbar("Pilih menu isi paket dulu.", { variant: "warning" });
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

    if (orderType === "Online" && !customerData.orderDate) {
      enqueueSnackbar("Pilih tanggal order online terlebih dahulu.", {
        variant: "warning",
      });
      return;
    }

    if (rawPlatformFee < 0) {
      enqueueSnackbar("Biaya platform tidak boleh minus.", {
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
      submitOrder(buildOrderData());
    }
  };

  const handleConfirmNonCashPayment = (selectedPaymentMethod) => {
    submitOrder(
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
    submitOrder(nextOrderData);
  };

  const orderMutation = useMutation({
    mutationFn: (reqData) => addOrder(reqData),
    retry: false,
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
    onSettled: () => {
      isSubmittingOrderRef.current = false;
    },
  });

  const submitOrder = (orderData) => {
    // Lock synchronously: a second click can arrive before React renders disabled.
    if (isSubmittingOrderRef.current) return;
    isSubmittingOrderRef.current = true;
    orderMutation.mutate(orderData);
  };

  // The same receipt template on every device: Thermer on Android, Chrome's
  // print dialog on a laptop or PC.
  const handlePrintReceipt = async () => {
    if (isPrintingReceiptRef.current) return;

    if (cartData.length === 0) {
      enqueueSnackbar("Please add at least one menu item before printing!", {
        variant: "warning",
      });
      return;
    }

    const paperWidth = await choosePaperWidth();
    if (!paperWidth) return;

    isPrintingReceiptRef.current = true;
    try {
      const didPrint = await printOrderReceipt({
        ...buildOrderData(),
        orderCode: "DRAFT",
        createdAt: new Date().toISOString(),
        paymentMethod: paymentMethod || "-",
      }, { isDraft: true, paperWidth });

      if (didPrint === false && !isAndroidDevice()) {
        enqueueSnackbar("Popup blocked. Please allow popups to print receipt.", {
          variant: "warning",
        });
      }
    } finally {
      window.setTimeout(() => { isPrintingReceiptRef.current = false; }, 3200);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between px-5 mt-2">
        <p className="text-xs text-[#ababab] font-medium mt-2">
          Items({cartData.length})
        </p>
        <h1 className="text-[#f5f5f5] text-md font-bold">
          {formatCurrency(total + totalDiscount)}
        </h1>
      </div>
      {totalDiscount > 0 && (
        <div className="flex items-center justify-between px-5 mt-2">
          <p className="text-xs text-[#ababab] font-medium mt-2">Diskon</p>
          <h1 className="text-emerald-300 text-md font-bold">
            -{formatCurrency(totalDiscount)}
          </h1>
        </div>
      )}
      {onlineOrderCharge > 0 && (
        <div className="flex items-center justify-between px-5 mt-2">
          <p className="text-xs text-[#ababab] font-medium mt-2">
            Online
          </p>
          <h1 className="text-[#f5f5f5] text-md font-bold">
            {formatCurrency(onlineOrderCharge)}
          </h1>
        </div>
      )}
      <div className="flex items-center justify-between px-5 mt-2">
        <p className="text-xs text-[#ababab] font-medium mt-2">{taxLabel}</p>
        <h1 className="text-[#f5f5f5] text-md font-bold">
          {formatCurrency(itemTax)}
        </h1>
      </div>
      {platformFee > 0 && (
        <div className="flex items-center justify-between px-5 mt-2">
          <p className="text-xs text-[#ababab] font-medium mt-2">
            {getPlatformFeeLabel()}
          </p>
          <h1 className="text-[#f5f5f5] text-md font-bold">
            -{formatCurrency(platformFee)}
          </h1>
        </div>
      )}
      <div className="flex items-center justify-between px-5 mt-2">
        <p className="text-xs text-[#ababab] font-medium mt-2">
          Total
        </p>
        <h1 className="text-[#f5f5f5] text-md font-bold">
          {formatCurrency(totalPriceWithTax)}
        </h1>
      </div>
      <div className="px-5 mt-3">
        <label className="block text-[#ababab] mb-2 text-xs font-medium">
          Catatan Pesanan (opsional)
        </label>
        <textarea
          value={customerData.note || ""}
          onChange={(event) =>
            dispatch(setCustomer({ note: event.target.value }))
          }
          placeholder="Contoh: less sugar, tanpa es, dibungkus terpisah"
          rows={2}
          className="w-full resize-none rounded-lg bg-[#1f1f1f] px-4 py-3 text-sm text-white outline-none"
        />
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

      {paperDialog}

      <div className="flex flex-col sm:flex-row items-center gap-3 px-5 mt-4 pb-4">
        <button
          onClick={handlePrintReceipt}
          className="bg-[#025cca] px-4 py-3 w-full rounded-lg text-[#f5f5f5] font-semibold text-lg"
        >
          Print Receipt
        </button>
        <button
          onClick={handlePlaceOrder}
          disabled={orderMutation.isPending || showNonCashPayment || stockWarningItems.length > 0 || cartData.length === 0}
          aria-busy={orderMutation.isPending}
          className="bg-[#a79981] px-4 py-3 w-full rounded-lg text-[#101010] font-semibold text-lg disabled:cursor-not-allowed disabled:opacity-50"
        >
          {orderMutation.isPending ? "Menyimpan..." : "Place Order"}
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
