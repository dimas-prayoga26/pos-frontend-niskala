import React, { useState } from "react";
import { formatCurrency, formatDateAndTime } from "../../utils/index";

const OrderCard = ({
  order,
  onCateringPaidChange,
  isUpdatingCateringPayment = false,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const orderCode = order.orderId || order.orderCode || `ORD-${String(order.id).padStart(6, "0")}`;
  const cateringDetails = order.cateringDetails;
  const isCatering = Boolean(cateringDetails);
  const isCateringPaid = Boolean(cateringDetails?.isPaid);
  const cateringPaymentLabel = isCateringPaid ? "Lunas" : "Belum Lunas";
  const nextCateringPaymentStatus = !isCateringPaid;
  const formatEventDate = (value) => {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString("id-ID");
  };

  return (
    <>
      <div className="w-full bg-[#262626] p-4 rounded-lg mb-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 w-full">
            <div className="flex flex-col items-start gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[#f5f5f5] text-lg font-semibold tracking-wide">
                  {order.customerDetails.name}
                </h1>
                {isCatering && (
                  <span className="rounded-md bg-[#255c38] px-2 py-1 text-xs font-bold text-[#e7ffe9]">
                    Catering
                  </span>
                )}
              </div>
              <p className="text-[#ababab] text-sm">
                Order ID: #{orderCode}
              </p>
              {cateringDetails?.note && (
                <p className="mt-2 line-clamp-2 text-sm text-[#c9c0b0]">
                  Catatan: {cateringDetails.note}
                </p>
              )}
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
        <div className="flex flex-col sm:flex-row sm:justify-between gap-2 sm:items-center mt-4 text-[#ababab]">
          <p>{formatDateAndTime(order.orderDate)}</p>
          <p>{order.items.length} Items</p>
        </div>
        <hr className="w-full mt-4 border-t-1 border-gray-500" />
        <div className="flex items-center justify-between mt-4">
          <h1 className="text-[#f5f5f5] text-lg font-semibold">Total</h1>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isCatering && (
              <button
                type="button"
                onClick={() => onCateringPaidChange?.(nextCateringPaymentStatus)}
                disabled={isUpdatingCateringPayment}
                title={
                  isCateringPaid
                    ? "Klik untuk tandai belum lunas"
                    : "Klik untuk tandai lunas"
                }
                className={`rounded-md px-2 py-1 text-xs font-bold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 ${
                  isCateringPaid
                    ? "bg-[#2e5b46] text-[#bdf5d3]"
                    : "bg-[#5d4b24] text-[#ffe0a3]"
                }`}
              >
                {isUpdatingCateringPayment ? "Menyimpan..." : cateringPaymentLabel}
              </button>
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
                <span>Tax (11%)</span>
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
