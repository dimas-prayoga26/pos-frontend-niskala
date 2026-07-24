import React, { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { getOrders } from "../../https/index";
import {
  formatCurrency,
  formatDateAndTime,
  getJakartaDateKey,
} from "../../utils";

const RecentOrders = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState(getJakartaDateKey());

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
  const getOrderTypeLabel = (order) => {
    const isCatering =
      Boolean(order.cateringDetails) ||
      order.items?.some((item) => item.categoryName === "Catering");

    if (isCatering) return "Catering";

    if (order.orderType === "Online") {
      return order.orderPlatform ? `Online / ${order.orderPlatform}` : "Online";
    }

    return order.orderType || "Offline";
  };

  const ordersByDate = useMemo(() => {
    return orders.filter((order) => {
      if (!selectedDate) return true;

      return getJakartaDateKey(order.orderDate) === selectedDate;
    });
  }, [orders, selectedDate]);

  const filteredOrders = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();

    const searchedOrders = !keyword
      ? ordersByDate
      : ordersByDate.filter((order) => {
          const orderCode =
            order.orderId ||
            order.orderCode ||
            `ORD-${String(order.id).padStart(6, "0")}`;
          const itemCount = order.items?.length || 0;
          const searchableText = [
            orderCode,
            order.customerDetails?.name,
            formatDateAndTime(order.orderDate),
            `${itemCount} Items`,
            getOrderTypeLabel(order),
            order.orderPlatform,
            formatCurrency(order.bills?.totalWithTax || 0),
            order.paymentMethod,
          ]
            .join(" ")
            .toLowerCase();

          return searchableText.includes(keyword);
        });

    return searchedOrders
      .sort((first, second) => new Date(second.orderDate) - new Date(first.orderDate))
      .slice(0, 10);
  }, [ordersByDate, searchQuery]);

  return (
    <div className="container mx-auto bg-[#262626] p-4 rounded-lg">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-[#f5f5f5] text-xl font-semibold">
            Pesanan Terbaru
          </h2>
          <p className="mt-1 text-sm text-[#ababab]">
            Total pesanan:{" "}
            <span className="font-semibold text-[#f5f5f5]">
              {ordersByDate.length}
            </span>
            {searchQuery.trim() && (
              <>
                {" "}
                | Ditampilkan:{" "}
                <span className="font-semibold text-[#f5f5f5]">
                  {filteredOrders.length}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
          <input
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            type="date"
            className="w-full rounded-lg bg-[#1f1f1f] px-4 py-2 text-sm font-semibold text-[#f5f5f5] outline-none [color-scheme:dark] sm:w-[180px]"
          />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            type="search"
            placeholder="Cari pesanan"
            className="w-full rounded-lg bg-[#1f1f1f] px-4 py-2 text-sm font-semibold text-[#f5f5f5] outline-none placeholder:text-[#777] sm:w-[320px]"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[#f5f5f5]">
          <thead className="bg-[#333] text-[#ababab]">
            <tr>
              <th className="p-3">Order ID</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Tanggal & Jam</th>
              <th className="p-3">Items</th>
              <th className="p-3">Tipe Order</th>
              <th className="p-3">Total</th>
              <th className="p-3 text-center">Metode Bayar</th>
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
                <td className="p-4">{order.customerDetails?.name || "-"}</td>
                <td className="p-4">{formatDateAndTime(order.orderDate)}</td>
                <td className="p-4">{order.items?.length || 0} Items</td>
                <td className="p-4">{getOrderTypeLabel(order)}</td>
                <td className="p-4">{formatCurrency(order.bills?.totalWithTax || 0)}</td>
                <td className="p-4">
                  {order.paymentMethod}
                </td>
              </tr>
            ))}
            {filteredOrders.length === 0 && (
              <tr>
                <td className="p-4 text-center text-[#ababab]" colSpan={7}>
                  Tidak ada pesanan pada tanggal ini
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
