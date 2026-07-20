import React, { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getCategories, getMenuItems, getOrders, getStockItems } from "../../https";
import { formatCurrency, getOrderReceivedAmount } from "../../utils";

const MetricCard = ({ item }) => {
  return (
    <div
      className="shadow-sm rounded-lg p-4"
      style={{ backgroundColor: item.color }}
    >
      <div className="flex justify-between items-center">
        <p className="font-medium text-xs text-[#f5f5f5]">{item.title}</p>
        <span className="rounded-md bg-black/20 px-2 py-1 text-xs font-bold text-[#f5f5f5]">
          {item.badge}
        </span>
      </div>
      <p className="mt-1 font-semibold text-2xl text-[#f5f5f5]">
        {item.value}
      </p>
    </div>
  );
};

const Metrics = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("last-month");
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);
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

  const {
    data: stockItemsRes,
    isLoading: isStockItemsLoading,
    isError: isStockItemsError,
  } = useQuery({
    queryKey: ["stock-items"],
    queryFn: getStockItems,
    placeholderData: keepPreviousData,
  });

  const periodOptions = [
    { value: "today", label: "Today", badge: "Hari ini" },
    { value: "last-7-days", label: "Last 7 Days", badge: "7 hari" },
    { value: "last-month", label: "Last 1 Month", badge: "1 bulan" },
    { value: "last-3-months", label: "Last 3 Months", badge: "3 bulan" },
    { value: "all-time", label: "All Time", badge: "Semua" },
  ];
  const activePeriod =
    periodOptions.find((period) => period.value === selectedPeriod) ||
    periodOptions[2];

  const getPeriodStartDate = (period) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);

    if (period === "today") return date;

    if (period === "last-7-days") {
      date.setDate(date.getDate() - 6);
      return date;
    }

    if (period === "last-month") {
      date.setMonth(date.getMonth() - 1);
      return date;
    }

    if (period === "last-3-months") {
      date.setMonth(date.getMonth() - 3);
      return date;
    }

    return null;
  };

  const totalCategories = categoriesRes?.data?.data?.length || 0;
  const totalDishes = menuItemsRes?.data?.data?.length || 0;
  const orders = ordersRes?.data?.data || [];
  const stockItems = stockItemsRes?.data?.data || [];
  const periodStartDate = useMemo(
    () => getPeriodStartDate(selectedPeriod),
    [selectedPeriod]
  );
  const filteredOrders = useMemo(() => {
    if (!periodStartDate) return orders;

    return orders.filter((order) => {
      const orderDate = new Date(order.orderDate);

      if (Number.isNaN(orderDate.getTime())) return false;

      return orderDate >= periodStartDate;
    });
  }, [orders, periodStartDate]);
  const periodRevenue = filteredOrders.reduce(
    (total, order) => total + getOrderReceivedAmount(order),
    0
  );
  const averageOrderValue = filteredOrders.length
    ? periodRevenue / filteredOrders.length
    : 0;
  const unpaidCateringOrders = filteredOrders.filter((order) => {
    return order.cateringDetails && !order.cateringDetails.isPaid;
  }).length;
  const stockNeedsOrder = stockItems.filter(
    (item) => item.status === "HARUS ORDER"
  ).length;

  const isLoading =
    isOrdersLoading ||
    isCategoriesLoading ||
    isMenuItemsLoading ||
    isStockItemsLoading;
  const hasError =
    isOrdersError ||
    isCategoriesError ||
    isMenuItemsError ||
    isStockItemsError;

  const transactionMetrics = [
    {
      title: "Pendapatan",
      value: isLoading ? "..." : formatCurrency(periodRevenue),
      badge: activePeriod.badge,
      color: "#025cca",
    },
    {
      title: "Total Order",
      value: isLoading ? "..." : filteredOrders.length,
      badge: activePeriod.badge,
      color: "#02a05a",
    },
    {
      title: "Rata-rata Transaksi",
      value: isLoading ? "..." : formatCurrency(averageOrderValue),
      badge: activePeriod.badge,
      color: "#b58105",
    },
    {
      title: "Catering Belum Lunas",
      value: isLoading ? "..." : unpaidCateringOrders,
      badge: activePeriod.badge,
      color: "#be3e3f",
    },
  ];

  const operationalMetrics = [
    {
      title: "Total Category",
      value: isCategoriesLoading ? "..." : totalCategories,
      badge: "Live",
      color: "#5b45b0",
    },
    {
      title: "Total Menu",
      value: isMenuItemsLoading ? "..." : totalDishes,
      badge: "Live",
      color: "#285430",
    },
    {
      title: "Stok Yang Harus Diorder",
      value: isStockItemsLoading ? "..." : stockNeedsOrder,
      badge: "Restock",
      color: "#735f32",
    },
    {
      title: "Total Stok Item",
      value: isStockItemsLoading ? "..." : stockItems.length,
      badge: "Live",
      color: "#7f167f",
    },
  ];

  return (
    <div className="container mx-auto py-2 px-4 md:px-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="font-semibold text-[#f5f5f5] text-xl">Metrics</h2>
          <p className="text-sm text-[#ababab]">
            Ringkasan transaksi dan operasional restoran.
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsPeriodOpen((current) => !current)}
            className="flex min-w-[150px] items-center justify-between gap-3 rounded-md bg-[#1a1a1a] px-4 py-2 text-[#f5f5f5]"
          >
            <span>{activePeriod.label}</span>
            <svg
              className={`h-3 w-3 transition-transform ${
                isPeriodOpen ? "rotate-180" : ""
              }`}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="4"
            >
              <path d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {isPeriodOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-44 overflow-hidden rounded-lg border border-[#333] bg-[#1a1a1a] shadow-2xl shadow-black/40">
              {periodOptions.map((period) => (
                <button
                  key={period.value}
                  type="button"
                  onClick={() => {
                    setSelectedPeriod(period.value);
                    setIsPeriodOpen(false);
                  }}
                  className={`block w-full px-4 py-3 text-left text-sm font-semibold hover:bg-[#262626] ${
                    selectedPeriod === period.value
                      ? "bg-[#a79981] text-[#101010]"
                      : "text-[#f5f5f5]"
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {transactionMetrics.map((metric, index) => {
          return <MetricCard key={index} item={metric} />;
        })}
      </div>

      <div className="flex flex-col justify-between mt-12">
        <div>
          <h2 className="font-semibold text-[#f5f5f5] text-xl">Operational</h2>
          <p className="text-sm text-[#ababab]">
            Data master menu dan stok dari aplikasi POS.
          </p>
          {hasError && (
            <p className="text-sm text-red-400 mt-1">
              Beberapa data belum bisa dimuat. Pastikan backend dan MySQL aktif.
            </p>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {operationalMetrics.map((item, index) => {
            return <MetricCard key={index} item={item} />;
          })}
        </div>
      </div>
    </div>
  );
};

export default Metrics;
