import React, { useState } from "react";
import { formatCurrency, formatDateAndTime } from "../../utils/index";

const OrderCard = ({
  order,
  onCateringPaymentAdd,
  isAddingCateringPayment = false,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const orderCode = order.orderId || order.orderCode || `ORD-${String(order.id).padStart(6, "0")}`;
  const cateringDetails = order.cateringDetails;
  const isCatering = Boolean(cateringDetails);
  const isOnlineOrder =
    order.orderType === "Online" || (Number(order.bills?.onlineOrderCharge) || 0) > 0;
  const cateringTotal = Number(order.bills?.totalWithTax) || 0;
  const rawCateringPaid = Number(cateringDetails?.dp ?? order.bills?.dp ?? 0) || 0;
  const isFullCateringPayment = cateringDetails?.paymentPlan !== "DP";
  const cateringPaid = isFullCateringPayment
    ? cateringTotal
    : rawCateringPaid;
  const cateringRemaining = Math.max(cateringTotal - cateringPaid, 0);
  const isCateringPaid = isCatering && cateringRemaining === 0;
  const cateringPaymentLabel = isCateringPaid ? "Lunas" : "Belum Lunas";
  const cateringPaidLabel =
    cateringDetails?.paymentPlan === "DP" && cateringRemaining > 0
      ? "DP"
      : "Dibayar";
  const canAddCateringPayment = isCatering && cateringRemaining > 0;
  const formatEventDate = (value) => {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString("id-ID");
  };

  const handleSubmitPayment = (event) => {
    event.preventDefault();

    const amount = Number(paymentAmount);

    if (!Number.isFinite(amount) || amount <= 0) return;

    onCateringPaymentAdd?.(amount);
    setPaymentAmount("");
  };

  return (
    <>
      <div className="w-full rounded-lg bg-[#262626] p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 w-full">
            <div className="flex flex-col items-start gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[#f5f5f5] text-lg font-semibold tracking-wide">
                  {order.customerDetails.name}
                </h1>
                {isCatering && (
                  <span className="rounded-md bg-[#a79981] px-2 py-1 text-xs font-bold text-[#101010]">
                    Catering
                  </span>
                )}
                {isOnlineOrder && (
                  <span className="rounded-md bg-[#2e5b46] px-2 py-1 text-xs font-bold text-[#bdf5d3]">
                    {order.orderPlatform || "Online"}
                  </span>
                )}
              </div>
              <p className="text-[#ababab] text-sm">
                Order ID: #{orderCode}
              </p>
            </div>
            <div className="flex flex-col sm:items-end gap-2">
              <button
                onClick={() => setShowDetails(true)}
                className="rounded-lg border border-[#a79981]/50 px-3 py-1.5 text-xs font-semibold text-[#a79981] hover:bg-[#a79981] hover:text-[#101010]"
              >
                View Details
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 text-[#ababab] sm:flex-row sm:items-center sm:justify-between">
          <p>{formatDateAndTime(order.orderDate)}</p>
          <p>{order.items.length} Items</p>
        </div>
        <hr className="w-full mt-4 border-t-1 border-gray-500" />
        <div className="flex items-center justify-between mt-4">
          <h1 className="text-[#f5f5f5] text-lg font-semibold">Total</h1>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isCatering && (
              <span
                className={`rounded-md px-2 py-1 text-xs font-bold ${
                  isCateringPaid
                    ? "bg-[#2e5b46] text-[#bdf5d3]"
                    : "bg-[#5d4b24] text-[#ffe0a3]"
                }`}
              >
                {cateringPaymentLabel}
              </span>
            )}
            <p className="text-[#f5f5f5] text-lg font-semibold">
              {formatCurrency(order.bills.totalWithTax)}
            </p>
          </div>
        </div>
      </div>

      {showDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-lg bg-[#1f1f1f] text-[#f5f5f5] shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#333] p-4">
              <div>
                <h2 className="text-xl font-bold">Order Details</h2>
                <p className="mt-1 text-sm text-[#ababab]">
                  {order.customerDetails.name} / {order.items.length} Items
                </p>
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="rounded-lg bg-[#2a2a2a] px-3 py-1 text-sm text-[#ababab] hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-4">
              <div className="mb-4 grid grid-cols-1 gap-2 text-sm text-[#ababab] sm:grid-cols-2">
                <p>
                  <span className="text-[#f5f5f5]">Order ID:</span>{" "}
                  #{orderCode}
                </p>
                {isCatering && (
                  <p>
                    <span className="text-[#f5f5f5]">Jenis Order:</span>{" "}
                    Catering
                  </p>
                )}
                <p>
                  <span className="text-[#f5f5f5]">Order Type:</span>{" "}
                  {order.orderType || "-"}
                </p>
                {isOnlineOrder && (
                  <p>
                    <span className="text-[#f5f5f5]">Platform:</span>{" "}
                    {order.orderPlatform || "-"}
                  </p>
                )}
                <p>
                  <span className="text-[#f5f5f5]">Payment:</span>{" "}
                  {order.paymentMethod || "-"}
                </p>
                {cateringDetails && (
                  <>
                    <p>
                      <span className="text-[#f5f5f5]">Instansi:</span>{" "}
                      {cateringDetails.institution || "-"}
                    </p>
                    <p>
                      <span className="text-[#f5f5f5]">No. WA:</span>{" "}
                      {cateringDetails.whatsapp || "-"}
                    </p>
                    <p>
                      <span className="text-[#f5f5f5]">Tanggal Acara:</span>{" "}
                      {formatEventDate(cateringDetails.eventDate)}
                    </p>
                    <p>
                      <span className="text-[#f5f5f5]">Jam Kirim:</span>{" "}
                      {cateringDetails.deliveryTime || "-"}
                    </p>
                    <p>
                      <span className="text-[#f5f5f5]">Status Bayar:</span>{" "}
                      {cateringPaymentLabel}
                    </p>
                  </>
                )}
              </div>
              {cateringDetails?.note && (
                <div className="mb-4 rounded-lg bg-[#262626] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#a79981]">
                    Catatan Catering
                  </p>
                  <p className="mt-2 text-sm text-[#d4d4d4]">
                    {cateringDetails.note}
                  </p>
                </div>
              )}
              {isCatering && (
                <div className="mb-4 rounded-lg border border-[#333] bg-[#262626] p-3">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#a79981]">
                        Pembayaran Catering
                      </p>
                      <p className="mt-1 text-xs text-[#ababab]">
                        Catat pembayaran masuk untuk order ini.
                      </p>
                    </div>
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-bold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 ${
                        isCateringPaid
                          ? "bg-[#2e5b46] text-[#bdf5d3]"
                          : "bg-[#5d4b24] text-[#ffe0a3]"
                      }`}
                    >
                      {cateringPaymentLabel}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-3 text-[#ababab]">
                      <span>Total Tagihan</span>
                      <span className="font-semibold text-[#f5f5f5]">
                        {formatCurrency(cateringTotal)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3 text-[#ababab]">
                      <span>{cateringPaidLabel}</span>
                      <span>{formatCurrency(cateringPaid)}</span>
                    </div>
                    <div className="flex justify-between gap-3 text-[#ababab]">
                      <span>Sisa Pembayaran</span>
                      <span className="font-bold text-[#f5f5f5]">
                        {formatCurrency(cateringRemaining)}
                      </span>
                    </div>
                  </div>

                  {canAddCateringPayment && (
                    <form
                      onSubmit={handleSubmitPayment}
                      className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]"
                    >
                      <label className="block text-sm font-semibold text-[#ababab]">
                        Input Pembayaran
                        <div className="mt-2 flex overflow-hidden rounded-lg bg-[#1f1f1f]">
                          <span className="flex items-center px-4 text-sm font-bold text-[#a79981]">
                            Rp
                          </span>
                          <input
                            value={paymentAmount}
                            onChange={(event) =>
                              setPaymentAmount(event.target.value)
                            }
                            type="number"
                            min="1"
                            max={cateringRemaining}
                            placeholder="100000"
                            className="w-full bg-transparent py-3 pr-4 text-sm text-[#f5f5f5] outline-none"
                          />
                        </div>
                      </label>
                      <button
                        type="submit"
                        disabled={isAddingCateringPayment}
                        className="self-end rounded-lg bg-[#a79981] px-4 py-3 text-sm font-bold text-[#101010] transition hover:bg-[#b9aa91] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isAddingCateringPayment ? "Menyimpan..." : "Simpan"}
                      </button>
                    </form>
                  )}
                </div>
              )}
              <div className="space-y-3">
                {order.items.map((item) => (
                  <div key={item._id || item.id} className="rounded-lg bg-[#262626] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-[#f5f5f5]">
                          {item.name}
                        </h3>
                        <p className="mt-1 text-xs text-[#ababab]">
                          Qty: {item.quantity}
                          {item.variant ? ` / ${item.variant}` : ""}
                        </p>
                        {item.addOns?.length > 0 && (
                          <p className="mt-1 text-xs text-[#a79981]">
                            Add-ons:{" "}
                            {item.addOns
                              .map((addOn) => addOn.name)
                              .join(", ")}
                          </p>
                        )}
                      </div>
                      <p className="font-semibold text-[#f5f5f5]">
                        {formatCurrency(item.price)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-[#333] p-4">
              <div className="flex justify-between text-sm text-[#ababab]">
                <span>Subtotal</span>
                <span>{formatCurrency(order.bills.total)}</span>
              </div>
              {(Number(order.bills.onlineOrderCharge) || 0) > 0 && (
                <div className="mt-2 flex justify-between text-sm text-[#ababab]">
                  <span>Online (+20%)</span>
                  <span>{formatCurrency(order.bills.onlineOrderCharge)}</span>
                </div>
              )}
              <div className="mt-2 flex justify-between text-sm text-[#ababab]">
                <span>Tax</span>
                <span>{formatCurrency(order.bills.tax)}</span>
              </div>
              <div className="mt-3 flex justify-between text-lg font-bold text-[#f5f5f5]">
                <span>Total</span>
                <span>{formatCurrency(order.bills.totalWithTax)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OrderCard;
