import React, { useState } from "react";
import { formatCurrency, formatDateAndTime } from "../../utils/index";

const OrderCard = ({ key, order }) => {
  const [showDetails, setShowDetails] = useState(false);
  const orderCode = order.orderId || order.orderCode || `ORD-${String(order.id).padStart(6, "0")}`;

  return (
    <>
      <div key={key} className="w-full bg-[#262626] p-4 rounded-lg mb-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 w-full">
            <div className="flex flex-col items-start gap-1">
              <h1 className="text-[#f5f5f5] text-lg font-semibold tracking-wide">
                {order.customerDetails.name}
              </h1>
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
        <div className="flex flex-col sm:flex-row sm:justify-between gap-2 sm:items-center mt-4 text-[#ababab]">
          <p>{formatDateAndTime(order.orderDate)}</p>
          <p>{order.items.length} Items</p>
        </div>
        <hr className="w-full mt-4 border-t-1 border-gray-500" />
        <div className="flex items-center justify-between mt-4">
          <h1 className="text-[#f5f5f5] text-lg font-semibold">Total</h1>
          <p className="text-[#f5f5f5] text-lg font-semibold">
            {formatCurrency(order.bills.totalWithTax)}
          </p>
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
                <p>
                  <span className="text-[#f5f5f5]">Guests:</span>{" "}
                  {order.customerDetails.guests || 1}
                </p>
                <p>
                  <span className="text-[#f5f5f5]">Payment:</span>{" "}
                  {order.paymentMethod || "-"}
                </p>
              </div>

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
