import React, { useMemo, useState } from "react";
import { FaSearch } from "react-icons/fa";
import OrderList from "./OrderList";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { getOrders } from "../../https/index";

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

  const orders = resData?.data?.data || [];
  const getLocalDateKey = (value) => {
    const date = value ? new Date(value) : new Date();

    if (Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };
  const todayKey = getLocalDateKey();
  const todayOrders = orders.filter(
    (order) => getLocalDateKey(order.orderDate) === todayKey
  );

  const filteredOrders = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();

    if (!keyword) return todayOrders;

    return todayOrders.filter((order) => {
      const orderCode =
        order.orderId ||
        order.orderCode ||
        `ORD-${String(order.id).padStart(6, "0")}`;
      const orderDate = new Date(order.orderDate);
      const formattedOrderDate = Number.isNaN(orderDate.getTime())
        ? ""
        : `${orderDate.toLocaleDateString("en-US", {
            month: "long",
            day: "2-digit",
            year: "numeric",
          })} ${orderDate.toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })}`;

      const searchableText = [
        order.customerDetails?.name,
        orderCode,
        formattedOrderDate,
        `${order.items?.length || 0} Items`,
        order.orderStatus,
        order.orderType,
        order.orderPlatform,
        order.paymentMethod,
        order.bills?.totalWithTax,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(keyword);
    });
  }, [todayOrders, searchQuery]);

  return (
    <div className="px-4 md:px-8 mt-6">
      <div className="bg-[#1a1a1a] w-full min-h-[360px] md:h-[450px] rounded-lg">
        <div className="flex justify-between items-center px-6 py-4">
          <h1 className="text-[#f5f5f5] text-lg font-semibold tracking-wide">
            Pesanan Hari Ini
          </h1>
          <a href="" className="text-[#025cca] text-sm font-semibold">
            View all
          </a>
        </div>

        <div className="flex items-center gap-4 bg-[#1f1f1f] rounded-[15px] px-4 md:px-6 py-4 mx-4 md:mx-6">
          <FaSearch className="text-[#f5f5f5]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search today's orders"
            className="w-full bg-[#1f1f1f] outline-none text-[#f5f5f5]"
          />
        </div>

        {/* Order list */}
        <div className="mt-4 px-4 md:px-6 overflow-y-auto max-h-[300px] scrollbar-hide">
          {filteredOrders.length > 0 ? (
            filteredOrders.map((order) => {
              return <OrderList key={order._id} order={order} />;
            })
          ) : (
            <p className="col-span-3 text-gray-500">
              {searchQuery ? "No orders found" : "No orders today"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecentOrders;
