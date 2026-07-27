import React, { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  FiArchive,
  FiBookOpen,
  FiCreditCard,
  FiDollarSign,
  FiDownload,
  FiGrid,
  FiMonitor,
  FiPackage,
  FiShoppingBag,
  FiTrendingUp,
  FiTruck,
} from "react-icons/fi";
import * as XLSX from "xlsx-js-style";
import {
  getCategories,
  getMenuItems,
  getOrders,
  getRecaps,
  getStockItems,
} from "../../https";
import { formatCurrency, getOrderReceivedAmount } from "../../utils";

const jakartaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const toNumber = (value) => Number(value) || 0;

const getDateKey = (value = new Date()) => {
  if (!value) return "";

  if (typeof value === "string") {
    const dateMatch = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (dateMatch) return dateMatch[0];
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return jakartaDateFormatter.format(date);
};

const getDateFromKey = (dateKey) => new Date(`${dateKey}T00:00:00`);

const getMonthKey = (value = new Date()) => getDateKey(value).slice(0, 7);

const getMonthLabel = (value) => {
  const dateKey = String(value || "").slice(0, 7);
  if (!dateKey) return "-";

  const date = new Date(`${dateKey}-01T00:00:00`);
  return date.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
};

const getWeekRange = (date = new Date()) => {
  const current = new Date(date);
  current.setHours(0, 0, 0, 0);
  const mondayOffset = (current.getDay() + 6) % 7;
  const start = new Date(current);
  start.setDate(current.getDate() - mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    startKey: getDateKey(start),
    endKey: getDateKey(end),
  };
};

const isDateKeyInRange = (dateKey, startKey, endKey) => {
  if (!dateKey) return false;
  if (startKey && dateKey < startKey) return false;
  if (endKey && dateKey > endKey) return false;
  return true;
};

const formatDateTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  });
};

const getOrderCode = (order) =>
  order.orderId || order.orderCode || `ORD-${String(order.id).padStart(6, "0")}`;

const getOrderTypeLabel = (order) => {
  const isCatering =
    Boolean(order.cateringDetails) ||
    order.orderType === "Catering" ||
    order.items?.some((item) => item.categoryName === "Catering");

  if (isCatering) return "Catering";
  if (order.orderType === "Online") {
    return order.orderPlatform ? `Online / ${order.orderPlatform}` : "Online";
  }

  return order.orderType || "Offline";
};

const getOrderItemCount = (order) =>
  (order.items || []).reduce(
    (total, item) => total + (Number(item.quantity) || 1),
    0
  );

const rupiahExcelFormat = '"Rp" #,##0;[Red]-"Rp" #,##0;"Rp" 0';

const excelStyles = {
  title: {
    font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "1F4E3D" } },
    alignment: { horizontal: "center", vertical: "center" },
  },
  subtitle: {
    font: { bold: true, color: { rgb: "1F4E3D" } },
    fill: { fgColor: { rgb: "E8F3ED" } },
    alignment: { horizontal: "left", vertical: "center" },
  },
  header: {
    font: { bold: true, color: { rgb: "101010" } },
    fill: { fgColor: { rgb: "A79981" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "806F59" } },
      right: { style: "thin", color: { rgb: "806F59" } },
      bottom: { style: "thin", color: { rgb: "806F59" } },
      left: { style: "thin", color: { rgb: "806F59" } },
    },
  },
  cell: {
    alignment: { vertical: "top", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "D9D9D9" } },
      right: { style: "thin", color: { rgb: "D9D9D9" } },
      bottom: { style: "thin", color: { rgb: "D9D9D9" } },
      left: { style: "thin", color: { rgb: "D9D9D9" } },
    },
  },
  label: {
    font: { bold: true, color: { rgb: "1F1F1F" } },
    fill: { fgColor: { rgb: "F7F3EC" } },
    alignment: { vertical: "top", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "D6C7AE" } },
      right: { style: "thin", color: { rgb: "D6C7AE" } },
      bottom: { style: "thin", color: { rgb: "D6C7AE" } },
      left: { style: "thin", color: { rgb: "D6C7AE" } },
    },
  },
};

const getHeaderValueType = (header) => {
  const normalizedHeader = String(header || "").toLowerCase();

  if (
    /(omzet|hpp|laba|total|offline|online|catering|harga|cash|qris|transfer|pengeluaran|selisih|saldo|diterima|dp|sisa)/i.test(
      normalizedHeader
    )
  ) {
    return "currency";
  }

  if (/(trans|items|order cat|stok|minimal|qty)/i.test(normalizedHeader)) {
    return "number";
  }

  return "text";
};

const getSummaryValueType = (label) => {
  const normalizedLabel = String(label || "").toLowerCase();

  if (normalizedLabel.includes("stok harus order")) return "text";
  if (normalizedLabel.includes("catering aktif")) return "number";

  if (
    /(omzet|laba|offline|online|catering|saldo|hpp|kas)/i.test(
      normalizedLabel
    )
  ) {
    return "currency";
  }

  return "text";
};

const applyStyle = (worksheet, rowIndex, columnIndex, style) => {
  const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
  worksheet[address] = worksheet[address] || { t: "s", v: "" };
  worksheet[address].s = {
    ...(worksheet[address].s || {}),
    ...style,
  };
};

const applyValueFormat = (worksheet, address, valueType) => {
  if (!worksheet[address]) return;

  if (valueType === "currency") {
    worksheet[address].z = rupiahExcelFormat;
    worksheet[address].s = {
      ...(worksheet[address].s || {}),
      alignment: { horizontal: "right", vertical: "top", wrapText: true },
    };
  }

  if (valueType === "number") {
    worksheet[address].z = "#,##0";
    worksheet[address].s = {
      ...(worksheet[address].s || {}),
      alignment: { horizontal: "right", vertical: "top", wrapText: true },
    };
  }
};

const appendSheet = (workbook, sheetName, rows, widths = [], options = {}) => {
  const isSummarySheet = options.variant === "summary";
  const tableRows = isSummarySheet ? [["Metrik", "Nilai"], ...rows] : rows;
  const title = options.title || `NISKALA COFFEE & EATERY - ${sheetName.toUpperCase()}`;
  const subtitle =
    options.subtitle ||
    (options.downloadedAt
      ? `Laporan ${sheetName} | Diunduh ${options.downloadedAt}`
      : `Laporan ${sheetName}`);
  const exportedRows = [[title], [subtitle], [], ...tableRows];
  const headerRowIndex = 3;
  const maxColumnCount = Math.max(
    widths.length,
    ...exportedRows.map((row) => row.length),
    2
  );
  const worksheet = XLSX.utils.aoa_to_sheet(exportedRows);
  const lastRowIndex = exportedRows.length - 1;
  const lastColumnIndex = maxColumnCount - 1;
  const headerValues = exportedRows[headerRowIndex] || [];

  worksheet["!cols"] = Array.from({ length: maxColumnCount }, (_, index) => ({
    wch: widths[index] || 16,
  }));
  worksheet["!rows"] = exportedRows.map((_, index) => ({
    hpt: index === 0 ? 26 : index === 1 ? 20 : 18,
  }));
  worksheet["!merges"] = [
    {
      s: { r: 0, c: 0 },
      e: { r: 0, c: lastColumnIndex },
    },
    {
      s: { r: 1, c: 0 },
      e: { r: 1, c: lastColumnIndex },
    },
  ];
  worksheet["!freeze"] = { xSplit: 0, ySplit: headerRowIndex + 1 };
  worksheet["!views"] = [{ state: "frozen", xSplit: 0, ySplit: headerRowIndex + 1 }];
  worksheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: headerRowIndex, c: 0 },
      e: { r: lastRowIndex, c: lastColumnIndex },
    }),
  };

  applyStyle(worksheet, 0, 0, excelStyles.title);
  applyStyle(worksheet, 1, 0, excelStyles.subtitle);

  for (let columnIndex = 0; columnIndex < maxColumnCount; columnIndex += 1) {
    applyStyle(worksheet, headerRowIndex, columnIndex, excelStyles.header);
  }

  for (let rowIndex = headerRowIndex + 1; rowIndex <= lastRowIndex; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < maxColumnCount; columnIndex += 1) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const row = exportedRows[rowIndex] || [];
      const cellValue = row[columnIndex];

      if (cellValue === undefined) continue;

      worksheet[address] = worksheet[address] || { t: "s", v: cellValue };
      worksheet[address].s = columnIndex === 0 ? excelStyles.label : excelStyles.cell;

      const valueType = isSummarySheet
        ? columnIndex === 1
          ? getSummaryValueType(row[0])
          : "text"
        : getHeaderValueType(headerValues[columnIndex]);

      applyValueFormat(worksheet, address, valueType);
    }
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
};

const cardToneStyles = {
  sales: {
    card: "border-blue-500/30 bg-blue-500/10",
    icon: "bg-blue-500/15 text-blue-200",
    value: "text-blue-50",
  },
  catering: {
    card: "border-violet-500/30 bg-violet-500/10",
    icon: "bg-violet-500/15 text-violet-200",
    value: "text-violet-50",
  },
  offline: {
    card: "border-emerald-500/30 bg-emerald-500/10",
    icon: "bg-emerald-500/15 text-emerald-200",
    value: "text-emerald-50",
  },
  online: {
    card: "border-sky-500/30 bg-sky-500/10",
    icon: "bg-sky-500/15 text-sky-200",
    value: "text-sky-50",
  },
  cash: {
    card: "border-indigo-500/30 bg-indigo-500/10",
    icon: "bg-indigo-500/15 text-indigo-200",
    value: "text-indigo-50",
  },
  cost: {
    card: "border-amber-500/30 bg-amber-500/10",
    icon: "bg-amber-500/15 text-amber-200",
    value: "text-amber-50",
  },
  profit: {
    card: "border-teal-500/30 bg-teal-500/10",
    icon: "bg-teal-500/15 text-teal-200",
    value: "text-teal-50",
  },
  net: {
    card: "border-green-500/30 bg-green-500/10",
    icon: "bg-green-500/15 text-green-200",
    value: "text-green-50",
  },
  warning: {
    card: "border-orange-500/30 bg-orange-500/10",
    icon: "bg-orange-500/15 text-orange-200",
    value: "text-orange-50",
  },
  neutral: {
    card: "border-[#3a3a3a] bg-[#232323]",
    icon: "bg-[#333] text-[#d8d8d8]",
    value: "text-[#f5f5f5]",
  },
};

const MetricCard = ({ item, className = "" }) => {
  const Icon = item.icon;
  const tone = cardToneStyles[item.tone] || cardToneStyles.neutral;

  return (
    <div
      className={`min-h-[124px] rounded-lg border p-4 shadow-sm ${tone.card} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${tone.icon}`}
            >
              <Icon className="text-lg" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#f5f5f5]">
              {item.title}
            </p>
            {item.description && (
              <p className="mt-1 text-xs leading-4 text-[#ababab]">
                {item.description}
              </p>
            )}
          </div>
        </div>
        <span className="shrink-0 rounded-md bg-black/20 px-2 py-1 text-xs font-bold text-[#f5f5f5]">
          {item.badge}
        </span>
      </div>
      <p className={`mt-4 text-2xl font-bold ${tone.value}`}>
        {item.value}
      </p>
    </div>
  );
};

const FinancialCard = ({ item, className = "" }) => {
  return <MetricCard item={item} className={className} />;
};

const MetricCardSlider = ({ items, renderItem }) => {
  return (
    <div className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 scrollbar-hide sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 xl:grid-cols-4">
      {items.map((item, index) =>
        renderItem ? (
          renderItem(item, index)
        ) : (
          <MetricCard
            key={index}
            item={item}
            className="min-w-full snap-start sm:min-w-0"
          />
        )
      )}
    </div>
  );
};

const ProfitFlow = ({ revenue, cost, grossProfit, netProfit, isLoading }) => {
  const steps = [
    {
      label: "Penjualan",
      value: isLoading ? "..." : formatCurrency(revenue),
      tone: "sales",
    },
    {
      label: "HPP",
      value: isLoading ? "..." : formatCurrency(cost),
      tone: "cost",
    },
    {
      label: "Untung Kotor",
      value: isLoading ? "..." : formatCurrency(grossProfit),
      tone: "profit",
    },
    {
      label: "Untung Bersih",
      value: isLoading ? "..." : formatCurrency(netProfit),
      tone: "net",
    },
  ];

  return (
    <div className="mt-5 rounded-lg border border-[#333] bg-[#202020] p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {steps.map((step, index) => {
          const tone = cardToneStyles[step.tone] || cardToneStyles.neutral;

          return (
            <div key={step.label} className="flex items-center gap-3">
              <div className={`h-2 w-2 rounded-full ${tone.icon}`} />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#ababab]">
                  {step.label}
                </p>
                <p className="truncate text-sm font-bold text-[#f5f5f5]">
                  {step.value}
                </p>
              </div>
              {index < steps.length - 1 && (
                <span className="ml-auto hidden text-[#666] md:block">-</span>
              )}
            </div>
          );
        })}
      </div>
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

  const {
    data: dailyRecapsRes,
    isLoading: isDailyRecapsLoading,
    isError: isDailyRecapsError,
  } = useQuery({
    queryKey: ["recaps", "daily"],
    queryFn: () => getRecaps("daily"),
    placeholderData: keepPreviousData,
  });

  const {
    data: weeklyRecapsRes,
    isLoading: isWeeklyRecapsLoading,
    isError: isWeeklyRecapsError,
  } = useQuery({
    queryKey: ["recaps", "weekly"],
    queryFn: () => getRecaps("weekly"),
    placeholderData: keepPreviousData,
  });

  const {
    data: monthlyRecapsRes,
    isLoading: isMonthlyRecapsLoading,
    isError: isMonthlyRecapsError,
  } = useQuery({
    queryKey: ["recaps", "monthly"],
    queryFn: () => getRecaps("monthly"),
    placeholderData: keepPreviousData,
  });

  const periodOptions = [
    { value: "today", label: "Hari Ini", badge: "Hari ini" },
    { value: "last-7-days", label: "7 Hari Terakhir", badge: "7 hari" },
    { value: "last-month", label: "Bulan Ini", badge: "Bulan ini" },
    { value: "last-3-months", label: "3 Bulan Terakhir", badge: "3 bulan" },
    { value: "all-time", label: "Semua Data", badge: "Semua" },
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
      date.setDate(1);
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
  const dailyRecaps = dailyRecapsRes?.data?.data || [];
  const weeklyRecaps = weeklyRecapsRes?.data?.data || [];
  const monthlyRecaps = monthlyRecapsRes?.data?.data || [];
  const periodStartDate = useMemo(
    () => getPeriodStartDate(selectedPeriod),
    [selectedPeriod]
  );
  const filteredRecaps = useMemo(() => {
    return dailyRecaps.filter((recap) => {
      const recapDate = new Date(recap.recapDate);

      if (Number.isNaN(recapDate.getTime())) return false;
      if (!periodStartDate) return true;

      return recapDate >= periodStartDate;
    });
  }, [dailyRecaps, periodStartDate]);
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
  const isCateringOrder = (order) => {
    return (
      Boolean(order.cateringDetails) ||
      order.orderType === "Catering" ||
      order.items?.some((item) => item.categoryName === "Catering")
    );
  };
  const cateringRevenue = filteredOrders.reduce((total, order) => {
    if (!isCateringOrder(order)) return total;

    return total + getOrderReceivedAmount(order);
  }, 0);
  const offlineRevenue = filteredOrders.reduce((total, order) => {
    if (order.orderType === "Online" || isCateringOrder(order)) return total;

    return total + getOrderReceivedAmount(order);
  }, 0);
  const onlineRevenue = filteredOrders.reduce((total, order) => {
    if (order.orderType !== "Online" || isCateringOrder(order)) return total;

    return total + getOrderReceivedAmount(order);
  }, 0);
  const stockNeedsOrder = stockItems.filter(
    (item) => item.status === "HARUS ORDER"
  ).length;
  const grossProfitTotal = filteredRecaps.reduce(
    (total, recap) => total + (Number(recap.grossProfit) || 0),
    0
  );
  const cashBalanceTotal = filteredRecaps.reduce((total, recap) => {
    const cashIn = Number(recap.cashIn) || 0;
    const qrisIn = Number(recap.qrisIn) || 0;
    const transferIn = Number(recap.transferIn) || 0;
    const dailyExpense = Number(recap.dailyExpense) || 0;

    return total + cashIn + qrisIn + transferIn - dailyExpense;
  }, 0);
  const materialSpendTotal = filteredRecaps.reduce(
    (total, recap) => total + (Number(recap.hppTotal) || 0),
    0
  );
  const netProfitTotal = filteredRecaps.reduce((total, recap) => {
    const grossProfit = Number(recap.grossProfit) || 0;
    const dailyExpense = Number(recap.dailyExpense) || 0;

    return total + grossProfit - dailyExpense;
  }, 0);

  const isLoading =
    isOrdersLoading ||
    isCategoriesLoading ||
    isMenuItemsLoading ||
    isStockItemsLoading;
  const isFinancialLoading = isDailyRecapsLoading;
  const isExportDisabled =
    isLoading ||
    isFinancialLoading ||
    isWeeklyRecapsLoading ||
    isMonthlyRecapsLoading;
  const hasError =
    isOrdersError ||
    isCategoriesError ||
    isMenuItemsError ||
    isStockItemsError ||
    isDailyRecapsError ||
    isWeeklyRecapsError ||
    isMonthlyRecapsError;

  const transactionMetrics = [
    {
      title: "Total Penjualan",
      value: isLoading ? "..." : formatCurrency(periodRevenue),
      badge: activePeriod.badge,
      description: "Semua uang masuk dari order.",
      icon: FiDollarSign,
      tone: "sales",
    },
    {
      title: "Penjualan Catering",
      value: isLoading ? "..." : formatCurrency(cateringRevenue),
      badge: activePeriod.badge,
      description: "Order paket dan acara.",
      icon: FiTruck,
      tone: "catering",
    },
    {
      title: "Penjualan Offline",
      value: isLoading ? "..." : formatCurrency(offlineRevenue),
      badge: activePeriod.badge,
      description: "Transaksi langsung di kasir.",
      icon: FiShoppingBag,
      tone: "offline",
    },
    {
      title: "Penjualan Online",
      value: isLoading ? "..." : formatCurrency(onlineRevenue),
      badge: activePeriod.badge,
      description: "Order dari platform online.",
      icon: FiMonitor,
      tone: "online",
    },
  ];

  const operationalMetrics = [
    {
      title: "Perlu Belanja Stok",
      value: isStockItemsLoading ? "..." : stockNeedsOrder,
      badge: "Restock",
      description: "Bahan yang sudah di bawah batas aman.",
      icon: FiPackage,
      tone: "warning",
    },
    {
      title: "Jenis Bahan",
      value: isStockItemsLoading ? "..." : stockItems.length,
      badge: "Aktif",
      description: "Daftar bahan yang tercatat.",
      icon: FiArchive,
      tone: "neutral",
    },
    {
      title: "Kategori Menu",
      value: isCategoriesLoading ? "..." : totalCategories,
      badge: "Aktif",
      description: "Kelompok menu yang tersedia.",
      icon: FiGrid,
      tone: "neutral",
    },
    {
      title: "Total Menu",
      value: isMenuItemsLoading ? "..." : totalDishes,
      badge: "Aktif",
      description: "Menu yang masuk master data.",
      icon: FiBookOpen,
      tone: "offline",
    },
  ];

  const financialMetrics = [
    {
      title: "Uang Masuk Tercatat",
      value: isFinancialLoading ? "..." : formatCurrency(cashBalanceTotal),
      badge: activePeriod.badge,
      description: "Cash, QRIS, dan transfer setelah pengeluaran.",
      icon: FiCreditCard,
      tone: "cash",
    },
    {
      title: "HPP",
      value: isFinancialLoading ? "..." : formatCurrency(materialSpendTotal),
      badge: activePeriod.badge,
      description: "Perkiraan biaya bahan dari rekap.",
      icon: FiPackage,
      tone: "cost",
    },
    {
      title: "Untung Kotor",
      value: isFinancialLoading ? "..." : formatCurrency(grossProfitTotal),
      badge: activePeriod.badge,
      description: "Penjualan dikurangi modal bahan.",
      icon: FiTrendingUp,
      tone: "profit",
    },
    {
      title: "Untung Bersih",
      value: isFinancialLoading ? "..." : formatCurrency(netProfitTotal),
      badge: activePeriod.badge,
      description: "Untung setelah pengeluaran harian.",
      icon: FiDollarSign,
      tone: "net",
    },
  ];

  const handleExportMetrics = () => {
    const todayKey = getDateKey();
    const { startKey: weekStartKey, endKey: weekEndKey } = getWeekRange();
    const monthKey = getMonthKey();
    const monthStartKey = `${monthKey}-01`;

    const ordersInRange = (startKey, endKey, predicate = () => true) =>
      orders.filter((order) => {
        const orderDateKey = getDateKey(order.orderDate);
        return isDateKeyInRange(orderDateKey, startKey, endKey) && predicate(order);
      });

    const recapsInRange = (startKey, endKey) =>
      dailyRecaps.filter((recap) =>
        isDateKeyInRange(getDateKey(recap.recapDate), startKey, endKey)
      );

    const sumOrderRevenue = (orderList) =>
      orderList.reduce(
        (total, order) => total + getOrderReceivedAmount(order),
        0
      );

    const currentMonthOrders = ordersInRange(monthStartKey, todayKey);
    const currentMonthRecaps = recapsInRange(monthStartKey, todayKey);
    const currentMonthOfflineOrders = currentMonthOrders.filter(
      (order) => order.orderType !== "Online" && !isCateringOrder(order)
    );
    const currentMonthOnlineOrders = currentMonthOrders.filter(
      (order) => order.orderType === "Online" && !isCateringOrder(order)
    );
    const currentMonthCateringOrders = currentMonthOrders.filter(isCateringOrder);
    const currentMonthGrossProfit = currentMonthRecaps.reduce(
      (total, recap) => total + toNumber(recap.grossProfit),
      0
    );
    const currentMonthHpp = currentMonthRecaps.reduce(
      (total, recap) => total + toNumber(recap.hppTotal),
      0
    );
    const currentMonthCashBalance = currentMonthRecaps.reduce((total, recap) => {
      return (
        total +
        toNumber(recap.cashIn) +
        toNumber(recap.qrisIn) +
        toNumber(recap.transferIn) -
        toNumber(recap.dailyExpense)
      );
    }, 0);
    const stockNeedsOrderNames = stockItems
      .filter((item) => item.status === "HARUS ORDER")
      .map((item) => item.name)
      .join(", ");
    const activeCateringCount = orders.filter(
      (order) => isCateringOrder(order) && order.orderStatus !== "Completed"
    ).length;

    const workbook = XLSX.utils.book_new();

    appendSheet(
      workbook,
      "Ringkasan",
      [
        ["Omzet hari ini", sumOrderRevenue(ordersInRange(todayKey, todayKey))],
        [
          `Omzet minggu ini (${weekStartKey} s.d. ${weekEndKey})`,
          sumOrderRevenue(ordersInRange(weekStartKey, weekEndKey)),
        ],
        ["Omzet bulan ini", sumOrderRevenue(currentMonthOrders)],
        ["Laba kotor bulan ini", currentMonthGrossProfit],
        [" - Offline", sumOrderRevenue(currentMonthOfflineOrders)],
        [" - Online", sumOrderRevenue(currentMonthOnlineOrders)],
        [" - Catering", sumOrderRevenue(currentMonthCateringOrders)],
        ["Saldo kas", currentMonthCashBalance],
        ["HPP bulan ini", currentMonthHpp],
        ["Catering aktif (belum terkirim)", activeCateringCount],
        ["Stok HARUS ORDER", stockNeedsOrderNames || "-"],
      ],
      [42, 34],
      {
        variant: "summary",
        title: "NISKALA COFFEE & EATERY - RINGKASAN USAHA",
        subtitle: `Diunduh ${todayKey} | Periode bulan ${getMonthLabel(monthKey)}`,
        downloadedAt: todayKey,
      }
    );

    appendSheet(
      workbook,
      "Harian",
      [
        [
          "Tanggal",
          "Petugas",
          "Trans",
          "Offline",
          "Online",
          "Catering",
          "Total",
          "HPP",
          "Laba",
          "Selisih kas",
          "Menu laku",
          "Catatan",
        ],
        ...dailyRecaps.map((recap) => [
          getDateKey(recap.recapDate),
          recap.shiftOfficer || "-",
          toNumber(recap.transactionTotal),
          toNumber(recap.offlineRevenue),
          toNumber(recap.onlineRevenue),
          toNumber(recap.cateringRevenue),
          toNumber(recap.totalRevenue),
          toNumber(recap.hppTotal),
          toNumber(recap.grossProfit),
          toNumber(recap.cashDifference),
          recap.bestMenu || "-",
          recap.note || "-",
        ]),
      ],
      [14, 20, 10, 16, 16, 16, 16, 16, 16, 16, 24, 36]
    );

    appendSheet(
      workbook,
      "Mingguan",
      [
        [
          "Periode",
          "Offline",
          "Online",
          "Catering",
          "Total",
          "Laba kotor",
          "Order cat.",
          "Channel",
          "Evaluasi tim",
          "Evaluasi stok",
          "Action plan",
        ],
        ...weeklyRecaps.map((recap) => [
          `${getDateKey(recap.periodStartDate)} s.d. ${getDateKey(
            recap.periodEndDate
          )}`,
          toNumber(recap.offlineRevenue),
          toNumber(recap.onlineRevenue),
          toNumber(recap.cateringRevenue),
          toNumber(recap.totalOmzet),
          toNumber(recap.grossProfit),
          toNumber(recap.cateringOrderCount),
          recap.topChannel || "-",
          recap.teamEvaluation || "-",
          recap.stockEvaluation || "-",
          recap.actionPlan || "-",
        ]),
      ],
      [24, 16, 16, 16, 16, 16, 12, 16, 34, 34, 42]
    );

    appendSheet(
      workbook,
      "Bulanan",
      [
        [
          "Bulan",
          "Omzet",
          "HPP",
          "Laba kotor",
          "Laba bersih",
          "Order cat.",
          "Menu dipertahankan",
          "Menu dievaluasi",
          "Evaluasi promosi",
          "Evaluasi supplier",
          "Strategi bulan depan",
        ],
        ...monthlyRecaps.map((recap) => [
          getMonthLabel(recap.periodMonth),
          toNumber(recap.omzet),
          toNumber(recap.hppTotal),
          toNumber(recap.grossProfit),
          toNumber(recap.estimatedNetProfit),
          toNumber(recap.cateringOrderCount),
          recap.retainedMenu || "-",
          recap.evaluatedMenu || "-",
          recap.promotionEvaluation || "-",
          recap.supplierEvaluation || "-",
          recap.nextMonthStrategy || "-",
        ]),
      ],
      [18, 16, 16, 16, 16, 12, 28, 28, 34, 34, 42]
    );

    const orderRows = (orderList, includeCateringFields = false) => [
      includeCateringFields
        ? [
            "Order ID",
            "Tanggal",
            "Customer",
            "Items",
            "Status",
            "Metode Bayar",
            "Total",
            "DP diterima",
            "Sisa",
            "Tanggal event",
            "Lunas",
          ]
        : [
            "Order ID",
            "Tanggal",
            "Customer",
            "Items",
            "Tipe",
            "Platform",
            "Status",
            "Metode Bayar",
            "Total",
            "Diterima",
          ],
      ...orderList.map((order) =>
        includeCateringFields
          ? [
              getOrderCode(order),
              formatDateTime(order.orderDate),
              order.customerDetails?.name || "-",
              getOrderItemCount(order),
              order.orderStatus || "-",
              order.paymentMethod || "-",
              toNumber(order.bills?.totalWithTax),
              toNumber(order.cateringDetails?.dp || order.bills?.dp),
              toNumber(order.bills?.remainingBalance),
              getDateKey(order.cateringDetails?.eventDate || null) || "-",
              order.cateringDetails?.isPaid ? "Ya" : "Belum",
            ]
          : [
              getOrderCode(order),
              formatDateTime(order.orderDate),
              order.customerDetails?.name || "-",
              getOrderItemCount(order),
              getOrderTypeLabel(order),
              order.orderPlatform || "-",
              order.orderStatus || "-",
              order.paymentMethod || "-",
              toNumber(order.bills?.totalWithTax),
              getOrderReceivedAmount(order),
            ]
      ),
    ];

    appendSheet(
      workbook,
      "Catering",
      orderRows(orders.filter(isCateringOrder), true),
      [16, 24, 22, 10, 14, 16, 16, 16, 16, 16, 12]
    );
    appendSheet(
      workbook,
      "Online",
      orderRows(
        orders.filter((order) => order.orderType === "Online" && !isCateringOrder(order))
      ),
      [16, 24, 22, 10, 22, 18, 14, 16, 16, 16]
    );
    appendSheet(
      workbook,
      "Offline",
      orderRows(
        orders.filter((order) => order.orderType !== "Online" && !isCateringOrder(order))
      ),
      [16, 24, 22, 10, 18, 14, 14, 16, 16, 16]
    );

    appendSheet(
      workbook,
      "Kas",
      [
        [
          "Tanggal",
          "Petugas",
          "Cash masuk",
          "QRIS masuk",
          "Transfer masuk",
          "Pengeluaran",
          "Selisih kas",
          "Saldo kas estimasi",
        ],
        ...dailyRecaps.map((recap) => {
          const cashBalance =
            toNumber(recap.cashIn) +
            toNumber(recap.qrisIn) +
            toNumber(recap.transferIn) -
            toNumber(recap.dailyExpense);

          return [
            getDateKey(recap.recapDate),
            recap.shiftOfficer || "-",
            toNumber(recap.cashIn),
            toNumber(recap.qrisIn),
            toNumber(recap.transferIn),
            toNumber(recap.dailyExpense),
            toNumber(recap.cashDifference),
            cashBalance,
          ];
        }),
      ],
      [14, 20, 16, 16, 18, 16, 16, 20]
    );

    appendSheet(
      workbook,
      "Stok",
      [
        ["Nama", "Kategori", "Stok", "Minimal", "Unit", "Supplier", "Status"],
        ...stockItems.map((item) => [
          item.name,
          item.category || "-",
          toNumber(item.stock),
          toNumber(item.minimumStock),
          item.unit || "-",
          item.supplier || "-",
          item.status || "-",
        ]),
      ],
      [28, 18, 12, 12, 12, 24, 18]
    );

    appendSheet(
      workbook,
      "Pembelian",
      [
        ["Tanggal", "Item", "Supplier", "Qty", "Satuan", "Harga", "Total", "Catatan"],
        ["Belum ada data pembelian"],
      ],
      [14, 28, 24, 10, 12, 16, 16, 36]
    );

    XLSX.writeFile(workbook, `Laporan-Niskala-${todayKey}.xlsx`);
  };

  return (
    <div className="container mx-auto py-2 px-4 md:px-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="font-semibold text-[#f5f5f5] text-xl">
            Ringkasan Usaha
          </h2>
          <p className="text-sm text-[#ababab]">
            Gambaran cepat penjualan, untung, stok, dan menu.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={handleExportMetrics}
            disabled={isExportDisabled}
            className="flex items-center justify-center gap-2 rounded-md bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010] transition hover:bg-[#b7aa94] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiDownload className="text-base" />
            Export
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsPeriodOpen((current) => !current)}
              className="flex min-w-full items-center justify-between gap-3 rounded-md bg-[#1a1a1a] px-4 py-2 text-[#f5f5f5] sm:min-w-[150px]"
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
              <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-full min-w-44 overflow-hidden rounded-lg border border-[#333] bg-[#1a1a1a] shadow-2xl shadow-black/40 sm:w-44">
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
      </div>

      <div className="mt-8">
        <div>
          <h2 className="font-semibold text-[#f5f5f5] text-xl">Penjualan</h2>
          <p className="text-sm text-[#ababab]">
            Uang masuk dari semua channel penjualan.
          </p>
        </div>
        <MetricCardSlider items={transactionMetrics} />
      </div>

      <div className="flex flex-col justify-between mt-12">
        <div>
          <h2 className="font-semibold text-[#f5f5f5] text-xl">Keuntungan</h2>
          <p className="text-sm text-[#ababab]">
            Alur sederhana dari penjualan, modal bahan, sampai untung bersih.
          </p>
        </div>

        <ProfitFlow
          revenue={periodRevenue}
          cost={materialSpendTotal}
          grossProfit={grossProfitTotal}
          netProfit={netProfitTotal}
          isLoading={isLoading || isFinancialLoading}
        />

        <MetricCardSlider
          items={financialMetrics}
          renderItem={(item, index) => (
            <FinancialCard
              key={index}
              item={item}
              className="min-w-full snap-start sm:min-w-0"
            />
          )}
        />
      </div>

      <div className="flex flex-col justify-between mt-12">
        <div>
          <h2 className="font-semibold text-[#f5f5f5] text-xl">Stok & Menu</h2>
          <p className="text-sm text-[#ababab]">
            Ringkasan bahan, kategori, dan daftar menu.
          </p>
          {hasError && (
            <p className="text-sm text-red-400 mt-1">
              Beberapa data belum bisa dimuat. Pastikan backend dan MySQL aktif.
            </p>
          )}
        </div>

        <MetricCardSlider items={operationalMetrics} />
      </div>
    </div>
  );
};

export default Metrics;
