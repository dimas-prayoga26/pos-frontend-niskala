import React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { metricsData } from "../../constants";
import { getCategories, getMenuItems, getOrders } from "../../https";

const MetricCard = ({ item }) => {
  return (
    <div
      className="shadow-sm rounded-lg p-4"
      style={{ backgroundColor: item.color }}
    >
      <div className="flex justify-between items-center">
        <p className="font-medium text-xs text-[#f5f5f5]">{item.title}</p>
        <div className="flex items-center gap-1">
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            style={{ color: item.isIncrease ? "#f5f5f5" : "red" }}
          >
            <path d={item.isIncrease ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
          </svg>
          <p
            className="font-medium text-xs"
            style={{ color: item.isIncrease ? "#f5f5f5" : "red" }}
          >
            {item.percentage}
          </p>
        </div>
      </div>
      <p className="mt-1 font-semibold text-2xl text-[#f5f5f5]">
        {item.value}
      </p>
    </div>
  );
};

const Metrics = () => {
  const {
    data: categoriesRes,
    isLoading: isCategoriesLoading,
    isError: isCategoriesError,
  } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
    placeholderData: keepPreviousData,
  });

  const {
    data: menuItemsRes,
    isLoading: isMenuItemsLoading,
    isError: isMenuItemsError,
  } = useQuery({
    queryKey: ["menu-items"],
    queryFn: () => getMenuItems(),
    placeholderData: keepPreviousData,
  });

  const {
    data: ordersRes,
    isLoading: isOrdersLoading,
    isError: isOrdersError,
  } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
    placeholderData: keepPreviousData,
  });

  const totalCategories = categoriesRes?.data?.data?.length || 0;
  const totalDishes = menuItemsRes?.data?.data?.length || 0;
  const orders = ordersRes?.data?.data || [];
  const activeOrders = orders.filter((order) => {
    return order.orderStatus === "In Progress";
  }).length;

  const isLoading = isOrdersLoading || isCategoriesLoading || isMenuItemsLoading;
  const hasError = isOrdersError || isCategoriesError || isMenuItemsError;

  const itemDetails = [
    {
      title: "Total Categories",
      value: isCategoriesLoading ? "..." : totalCategories,
      percentage: "Live",
      color: "#5b45b0",
      isIncrease: true,
    },
    {
      title: "Total Dishes",
      value: isMenuItemsLoading ? "..." : totalDishes,
      percentage: "Live",
      color: "#285430",
      isIncrease: true,
    },
    {
      title: "Active Orders",
      value: isLoading ? "..." : activeOrders,
      percentage: "Live",
      color: "#735f32",
      isIncrease: true,
    },
    {
      title: "Completed Orders",
      value: isLoading
        ? "..."
        : orders.filter((order) => order.orderStatus === "Completed").length,
      percentage: "Live",
      color: "#7f167f",
      isIncrease: true,
    },
  ];

  return (
    <div className="container mx-auto py-2 px-4 md:px-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="font-semibold text-[#f5f5f5] text-xl">
            Overall Performance
          </h2>
          <p className="text-sm text-[#ababab]">
            Ringkasan performa transaksi dan aktivitas restoran.
          </p>
        </div>
        <button className="flex items-center gap-1 px-4 py-2 rounded-md text-[#f5f5f5] bg-[#1a1a1a]">
          Last 1 Month
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="4"
          >
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {metricsData.map((metric, index) => {
          return <MetricCard key={index} item={metric} />;
        })}
      </div>

      <div className="flex flex-col justify-between mt-12">
        <div>
          <h2 className="font-semibold text-[#f5f5f5] text-xl">
            Item Details
          </h2>
          <p className="text-sm text-[#ababab]">
            Data kategori, menu, dan order customer dari aplikasi POS.
          </p>
          {hasError && (
            <p className="text-sm text-red-400 mt-1">
              Beberapa data belum bisa dimuat. Pastikan backend dan MySQL aktif.
            </p>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {itemDetails.map((item, index) => {
            return <MetricCard key={index} item={item} />;
          })}
        </div>
      </div>
    </div>
  );
};

export default Metrics;
