import React from "react";
import { formatJakartaDateTime, getAvatarName } from "../../utils/index";

const OrderList = ({ order }) => {
  const orderCode =
    order.orderId || order.orderCode || `ORD-${String(order.id).padStart(6, "0")}`;
  const avatarName = getAvatarName(order.customerDetails.name).slice(0, 2);
  const formattedOrderDate = formatJakartaDateTime(order.orderDate);

  return (
    <div className="mb-3 grid grid-cols-[52px_minmax(0,1fr)] items-center gap-3 rounded-lg px-0 py-1 sm:grid-cols-[52px_minmax(0,1.1fr)_minmax(160px,0.8fr)_minmax(190px,1fr)] sm:gap-4">
      <button className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#a79981] text-lg font-bold text-[#101010]">
        {avatarName}
      </button>

      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold tracking-wide text-[#f5f5f5]">
          {order.customerDetails.name}
        </h1>
        <p className="text-sm text-[#ababab]">{order.items.length} Items</p>
      </div>

      <p className="col-span-2 w-fit rounded-lg border border-[#a79981] px-2 py-1 text-sm font-semibold text-[#a79981] sm:col-span-1">
        Order ID: #{orderCode}
      </p>

      <p className="col-span-2 px-3 py-2 text-sm font-semibold text-[#f5f5f5] sm:col-span-1 sm:justify-self-end">
        Order Date: {formattedOrderDate}
      </p>
    </div>
  );
};

export default OrderList;
