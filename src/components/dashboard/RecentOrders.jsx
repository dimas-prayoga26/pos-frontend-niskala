import React, { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { getOrders } from "../../https/index";
import { formatCurrency, formatDateAndTime } from "../../utils";

const RecentOrders = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: resData, isError } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      return await getOrders();
    },
    placeholderData: keepPreviousData,
  });

  if (isError) {
    enqueueSnackbar("Something went wrong!", { variant: "error" });
  }

  const orders = resData?.data.data || [];
  const filteredOrders = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();

    if (!keyword) return orders;

    return orders.filter((order) => {
      const orderCode =
        order.orderId ||
        order.orderCode ||
        `ORD-${String(order.id).padStart(6, "0")}`;
      const searchableText = [
        orderCode,
        order.customerDetails?.name,
        formatDateAndTime(order.orderDate),
        `${order.items.length} Items`,
        order.orderType || "Customer",
        formatCurrency(order.bills.totalWithTax),
        order.paymentMethod,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(keyword);
    });
  }, [orders, searchQuery]);

  return (
    <div className="container mx-auto bg-[#262626] p-4 rounded-lg">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-[#f5f5f5] text-xl font-semibold">
          Recent Orders
        </h2>
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          type="search"
          placeholder="Search orders"
          className="w-full rounded-lg bg-[#1f1f1f] px-4 py-2 text-sm font-semibold text-[#f5f5f5] outline-none placeholder:text-[#777] md:max-w-xs"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[#f5f5f5]">
          <thead className="bg-[#333] text-[#ababab]">
            <tr>
              <th className="p-3">Order ID</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Date & Time</th>
              <th className="p-3">Items</th>
              <th className="p-3">Order Type</th>
              <th className="p-3">Total</th>
              <th className="p-3 text-center">Payment Method</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order, index) => (
              <tr
                key={index}
                className="border-b border-gray-600 hover:bg-[#333]"
              >
                <td className="p-4">
                  #{order.orderId || order.orderCode || `ORD-${String(order.id).padStart(6, "0")}`}
                </td>
                <td className="p-4">{order.customerDetails.name}</td>
                <td className="p-4">{formatDateAndTime(order.orderDate)}</td>
                <td className="p-4">{order.items.length} Items</td>
                <td className="p-4">Customer</td>
                <td className="p-4">{formatCurrency(order.bills.totalWithTax)}</td>
                <td className="p-4">
                  {order.paymentMethod}
                </td>
              </tr>
            ))}
            {filteredOrders.length === 0 && (
              <tr>
                <td className="p-4 text-center text-[#ababab]" colSpan={7}>
                  No orders found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentOrders;
