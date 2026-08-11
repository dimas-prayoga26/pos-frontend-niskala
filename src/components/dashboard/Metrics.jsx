import React, { useMemo, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { useSelector } from "react-redux";
import {
  FiArchive,
  FiBookOpen,
  FiCalendar,
  FiCreditCard,
  FiDollarSign,
  FiDownload,
  FiGrid,
  FiMonitor,
  FiPackage,
  FiPlus,
  FiShoppingBag,
  FiTrendingUp,
  FiTruck,
} from "react-icons/fi";
import * as XLSX from "xlsx-js-style";
import {
  addDailyCash,
  getCategories,
  getMenuItems,
  getOrders,
  getRecaps,
  getStockItems,
} from "../../https";
import {
  formatCurrency,
  getOrderItemHpp,
  getOrderReceivedAmount,
  getOrdersHppTotal,
} from "../../utils";

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

const getMonthKey = (value = new Date()) => getDateKey(value).slice(0, 7);

const getCurrentMonthStartKey = () => `${getMonthKey()}-01`;

const formatRangeBadge = (startKey, endKey) => {
  if (!startKey && !endKey) return "Select date";
  if (startKey && endKey && startKey === endKey) return startKey;
  if (startKey && endKey) return `${startKey} - ${endKey}`;
  if (startKey) return `Mulai ${startKey}`;
  return `Sampai ${endKey}`;
};

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

const normalizeNominalInput = (value) => {
  const digitsOnly = String(value).replace(/\D/g, "");

  return digitsOnly || "0";
};

const formatNominalInput = (value) =>
  Number(normalizeNominalInput(value)).toLocaleString("id-ID");

const createEmptyKasForm = () => ({
  recapId: "",
  method: "cash",
  amount: "",
  note: "",
});

const kasMethodOptions = [
  { value: "cash", label: "Cash" },
  { value: "qris", label: "QRIS" },
  { value: "transfer", label: "Transfer" },
];

const PERIOD_OPTIONS = [
  { value: "today", label: "Hari Ini", badge: "Hari ini" },
  { value: "last-7-days", label: "7 Hari Terakhir", badge: "7 hari" },
  { value: "last-month", label: "Bulan Ini", badge: "Bulan ini" },
  { value: "custom", label: "Select Date", badge: "Select date" },
];

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
  const queryClient = useQueryClient();
  const currentUser = useSelector((state) => state.user);
  const isAdmin = currentUser.role?.toLowerCase() === "admin";
  const [selectedPeriod, setSelectedPeriod] = useState("last-month");
  const [customDateRange, setCustomDateRange] = useState(() => ({
    startDate: getCurrentMonthStartKey(),
    endDate: getDateKey(),
  }));
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);
  const [isKasModalOpen, setIsKasModalOpen] = useState(false);
  const [kasForm, setKasForm] = useState(createEmptyKasForm);
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

  const periodRange = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    const todayKey = getDateKey(date);

    if (selectedPeriod === "today") {
      return { startKey: todayKey, endKey: todayKey };
    }

    if (selectedPeriod === "last-7-days") {
      date.setDate(date.getDate() - 6);
      return { startKey: getDateKey(date), endKey: todayKey };
    }

    if (selectedPeriod === "last-month") {
      date.setDate(1);
      return { startKey: getDateKey(date), endKey: todayKey };
    }

    if (selectedPeriod === "custom") {
      const startKey = customDateRange.startDate;
      const endKey = customDateRange.endDate;

      if (startKey && endKey && startKey > endKey) {
        return { startKey: endKey, endKey: startKey };
      }

      return { startKey, endKey };
    }

    return { startKey: getCurrentMonthStartKey(), endKey: todayKey };
  }, [customDateRange.endDate, customDateRange.startDate, selectedPeriod]);
  const activePeriod = useMemo(() => {
    const period =
      PERIOD_OPTIONS.find((item) => item.value === selectedPeriod) ||
      PERIOD_OPTIONS[2];

    if (selectedPeriod !== "custom") return period;

    return {
      ...period,
      badge: formatRangeBadge(periodRange.startKey, periodRange.endKey),
    };
  }, [selectedPeriod, periodRange.endKey, periodRange.startKey]);

  const totalCategories = categoriesRes?.data?.data?.length || 0;
  const menuItems = menuItemsRes?.data?.data || [];
  const totalDishes = menuItems.length;
  const orders = ordersRes?.data?.data || [];
  const stockItems = stockItemsRes?.data?.data || [];
  const dailyRecaps = dailyRecapsRes?.data?.data || [];
  const weeklyRecaps = weeklyRecapsRes?.data?.data || [];
  const monthlyRecaps = monthlyRecapsRes?.data?.data || [];
  const dailyRecapOptions = useMemo(
    () =>
      dailyRecaps.map((recap) => ({
        value: String(recap.id || recap._id),
        label: getDateKey(recap.recapDate),
        description: `${
          recap.shiftOfficer || recap.shiftOfficerName || "Petugas"
        } - ${formatCurrency(recap.totalRevenue)}`,
      })),
    [dailyRecaps]
  );
  const addKasMutation = useMutation({
    mutationFn: addDailyCash,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recaps"] });
      enqueueSnackbar("Kas berhasil ditambahkan", { variant: "success" });
      setKasForm(createEmptyKasForm());
      setIsKasModalOpen(false);
    },
    onError: (error) => {
      enqueueSnackbar(
        error?.response?.data?.message || "Gagal menambahkan kas",
        { variant: "error" }
      );
    },
  });
  const filteredRecaps = useMemo(() => {
    return dailyRecaps.filter((recap) => {
      const recapDateKey = getDateKey(recap.recapDate);

      return isDateKeyInRange(
        recapDateKey,
        periodRange.startKey,
        periodRange.endKey
      );
    });
  }, [dailyRecaps, periodRange]);
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const orderDateKey = getDateKey(order.orderDate);

      return isDateKeyInRange(
        orderDateKey,
        periodRange.startKey,
        periodRange.endKey
      );
    });
  }, [orders, periodRange]);
  const recappedDateKeys = useMemo(
    () => new Set(filteredRecaps.map((recap) => getDateKey(recap.recapDate))),
    [filteredRecaps]
  );
  const recappedOrders = useMemo(
    () =>
      filteredOrders.filter((order) =>
        recappedDateKeys.has(getDateKey(order.orderDate))
      ),
    [filteredOrders, recappedDateKeys]
  );
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
  const dailyExpenseTotal = filteredRecaps.reduce(
    (total, recap) => total + (Number(recap.dailyExpense) || 0),
    0
  );
  const cashRecordedTotal = filteredRecaps.reduce((total, recap) => {
    const cashIn = Number(recap.cashIn) || 0;
    const qrisIn = Number(recap.qrisIn) || 0;
    const transferIn = Number(recap.transferIn) || 0;

    return total + cashIn + qrisIn + transferIn;
  }, 0);
  const recappedRevenueTotal = recappedOrders.reduce(
    (total, order) => total + getOrderReceivedAmount(order),
    0
  );
  const materialSpendTotal = getOrdersHppTotal(filteredOrders, menuItems);
  const recappedMaterialSpendTotal = getOrdersHppTotal(recappedOrders, menuItems);
  const grossProfitTotal = recappedRevenueTotal - recappedMaterialSpendTotal;
  const netProfitTotal = grossProfitTotal - dailyExpenseTotal;

  const isLoading =
    isOrdersLoading ||
    isCategoriesLoading ||
    isMenuItemsLoading ||
    isStockItemsLoading;
  const isFinancialLoading =
    isDailyRecapsLoading || isOrdersLoading || isMenuItemsLoading;
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
      value: isFinancialLoading ? "..." : formatCurrency(cashRecordedTotal),
      badge: activePeriod.badge,
      description: "Cash, QRIS, dan transfer dari rekap harian.",
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

  const openKasModal = () => {
    if (!dailyRecapOptions.length) {
      enqueueSnackbar("Belum ada rekap harian untuk ditambahkan kas.", {
        variant: "warning",
      });
      return;
    }

    setKasForm({
      ...createEmptyKasForm(),
      recapId: dailyRecapOptions[0].value,
    });
    setIsKasModalOpen(true);
  };

  const updateKasForm = (field, value) => {
    setKasForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const submitKasForm = (event) => {
    event.preventDefault();

    const amount = Number(normalizeNominalInput(kasForm.amount));

    if (!kasForm.recapId) {
      enqueueSnackbar("Pilih rekap harian terlebih dahulu.", {
        variant: "warning",
      });
      return;
    }

    if (amount <= 0) {
      enqueueSnackbar("Nominal kas harus lebih dari 0.", {
        variant: "warning",
      });
      return;
    }

    addKasMutation.mutate({
      recapId: kasForm.recapId,
      method: kasForm.method,
      amount,
      note: kasForm.note,
    });
  };

  const handleExportMetrics = () => {
    const todayKey = getDateKey();
    const headers = [
      "No",
      "Tanggal",
      "Nama Menu",
      "Jumlah",
      " Harga ",
      " Total Harga ",
      "Jenis Pembayaran",
      " Potongan Pendapatan ",
      " Pendapatan Bersih ",
      " HPP ",
      " Keuntungan ",
    ];
    const isQrisPayment = (paymentMethod) =>
      String(paymentMethod || "").trim().toLowerCase() === "qris";
    const sortedOrders = [...filteredOrders].sort(
      (firstOrder, secondOrder) =>
        new Date(firstOrder.orderDate) - new Date(secondOrder.orderDate)
    );
    const reportRows = [];
    let rowNumber = 1;

    sortedOrders.forEach((order) => {
      const paymentMethod = order.paymentMethod || "-";
      const hasQrisDeduction = isQrisPayment(paymentMethod);

      (order.items || []).forEach((item) => {
        const quantity = Math.max(Number(item.quantity) || 0, 0);
        const price = toNumber(item.pricePerQuantity);
        const totalPrice = price * quantity;
        const deduction = hasQrisDeduction ? totalPrice * 0.007 : 0;
        const netRevenue = totalPrice - deduction;
        const hpp = getOrderItemHpp(item, menuItems) * quantity;

        reportRows.push([
          rowNumber,
          getDateKey(order.orderDate),
          item.name || "-",
          quantity,
          price,
          totalPrice,
          paymentMethod,
          deduction,
          netRevenue,
          hpp,
          netRevenue - hpp,
        ]);
        rowNumber += 1;
      });
    });

    const totalNetRevenue = reportRows.reduce(
      (total, row) => total + toNumber(row[8]),
      0
    );
    const totalHpp = reportRows.reduce(
      (total, row) => total + toNumber(row[9]),
      0
    );
    const totalProfit = reportRows.reduce(
      (total, row) => total + toNumber(row[10]),
      0
    );

    reportRows.push([
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "TOTAL",
      totalNetRevenue,
      totalHpp,
      totalProfit,
    ]);

    const periodLabel =
      selectedPeriod === "custom"
        ? formatRangeBadge(periodRange.startKey, periodRange.endKey)
        : activePeriod.label;
    const worksheetRows = [
      [`LAPORAN KEUANGAN NISKALA CAFE - ${periodLabel}`],
      headers,
      ...reportRows,
    ];
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetRows);
    const lastRowIndex = worksheetRows.length - 1;
    const lastColumnIndex = headers.length - 1;
    const lastDataRowIndex = Math.max(lastRowIndex - 1, 1);

    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 28 },
      { wch: 10 },
      { wch: 14 },
      { wch: 16 },
      { wch: 20 },
      { wch: 22 },
      { wch: 20 },
      { wch: 14 },
      { wch: 16 },
    ];
    worksheet["!rows"] = worksheetRows.map((_, rowIndex) => ({
      hpt: rowIndex === 0 ? 28 : rowIndex === 1 ? 24 : 21,
    }));
    worksheet["!merges"] = [
      {
        s: { r: 0, c: 0 },
        e: { r: 0, c: lastColumnIndex },
      },
    ];
    worksheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 1, c: 0 },
        e: { r: lastDataRowIndex, c: lastColumnIndex },
      }),
    };
    worksheet["!freeze"] = { xSplit: 0, ySplit: 2 };
    worksheet["!views"] = [{ state: "frozen", xSplit: 0, ySplit: 2 }];

    applyStyle(worksheet, 0, 0, {
      font: { bold: true, sz: 15, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "1F4E3D" } },
      alignment: { horizontal: "center", vertical: "center" },
    });

    headers.forEach((_, columnIndex) => {
      applyStyle(worksheet, 1, columnIndex, {
        ...excelStyles.header,
        alignment: {
          horizontal: "center",
          vertical: "center",
          wrapText: true,
        },
      });
    });

    for (let rowIndex = 2; rowIndex <= lastRowIndex; rowIndex += 1) {
      for (let columnIndex = 0; columnIndex <= lastColumnIndex; columnIndex += 1) {
        const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
        const isTotalRow = rowIndex === lastRowIndex;
        const isEvenDataRow = (rowIndex - 2) % 2 === 0;
        const baseDataStyle = {
          ...excelStyles.cell,
          fill: {
            fgColor: {
              rgb: isEvenDataRow ? "FFFFFF" : "F7F3EC",
            },
          },
        };
        const totalRowStyle = {
          ...excelStyles.header,
          fill: { fgColor: { rgb: "D9EAD3" } },
          font: { bold: true, color: { rgb: "1F1F1F" } },
        };

        applyStyle(
          worksheet,
          rowIndex,
          columnIndex,
          isTotalRow ? totalRowStyle : baseDataStyle
        );

        if ([0, 3, 4, 5, 7, 8, 9, 10].includes(columnIndex)) {
          worksheet[address].s = {
            ...(worksheet[address].s || {}),
            alignment: {
              horizontal: "right",
              vertical: "center",
              wrapText: true,
            },
          };
        }

        if ([1, 6].includes(columnIndex)) {
          worksheet[address].s = {
            ...(worksheet[address].s || {}),
            alignment: {
              horizontal: "center",
              vertical: "center",
              wrapText: true,
            },
          };
        }

        if ([0, 3].includes(columnIndex)) {
          worksheet[address].z = "#,##0";
        }

        if ([4, 5, 7, 8, 9, 10].includes(columnIndex)) {
          worksheet[address].z = rupiahExcelFormat;
        }
      }
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    XLSX.writeFile(workbook, `Laporan-Keuangan-Niskala-${todayKey}.xlsx`);
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
          {isAdmin && (
            <button
              type="button"
              onClick={openKasModal}
              className="flex items-center justify-center gap-2 rounded-md border border-[#a79981]/70 px-4 py-2 text-sm font-bold text-[#a79981] transition hover:bg-[#a79981] hover:text-[#101010]"
            >
              <FiPlus className="text-base" />
              Tambah Kas
            </button>
          )}
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
              <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-full min-w-44 overflow-hidden rounded-lg border border-[#333] bg-[#1a1a1a] shadow-2xl shadow-black/40 sm:w-72">
                {PERIOD_OPTIONS.map((period) => (
                  <button
                    key={period.value}
                    type="button"
                    onClick={() => {
                      setSelectedPeriod(period.value);
                      if (period.value !== "custom") {
                        setIsPeriodOpen(false);
                      }
                    }}
                    className={`block w-full px-4 py-3 text-left text-sm font-semibold hover:bg-[#262626] ${
                      selectedPeriod === period.value
                        ? "bg-[#a79981] text-[#101010]"
                        : "text-[#f5f5f5]"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      {period.value === "custom" && <FiCalendar />}
                      {period.label}
                    </span>
                  </button>
                ))}
                {selectedPeriod === "custom" && (
                  <div className="space-y-3 border-t border-[#333] p-4">
                    <label className="block text-xs font-semibold text-[#ababab]">
                      Dari
                      <input
                        type="date"
                        value={customDateRange.startDate}
                        onChange={(event) =>
                          setCustomDateRange((current) => ({
                            ...current,
                            startDate: event.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-md border border-[#333] bg-[#101010] px-3 py-2 text-sm font-semibold text-[#f5f5f5] outline-none transition focus:border-[#a79981]"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-[#ababab]">
                      Sampai
                      <input
                        type="date"
                        value={customDateRange.endDate}
                        onChange={(event) =>
                          setCustomDateRange((current) => ({
                            ...current,
                            endDate: event.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-md border border-[#333] bg-[#101010] px-3 py-2 text-sm font-semibold text-[#f5f5f5] outline-none transition focus:border-[#a79981]"
                      />
                    </label>
                  </div>
                )}
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
            Dihitung dari hari yang sudah masuk rekap harian.
          </p>
        </div>

        <ProfitFlow
          revenue={recappedRevenueTotal}
          cost={recappedMaterialSpendTotal}
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

      {isKasModalOpen && isAdmin && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-lg bg-[#262626] p-5 text-[#f5f5f5] shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold">Tambah Kas</h3>
                <p className="mt-1 text-sm text-[#ababab]">
                  Tambahkan uang masuk ke rekap harian yang sudah dibuat.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsKasModalOpen(false)}
                className="rounded-md bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5] transition hover:bg-[#404040]"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={submitKasForm} className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-bold text-[#bcbcbc]">
                  Tanggal rekap
                </span>
                <select
                  value={kasForm.recapId}
                  onChange={(event) =>
                    updateKasForm("recapId", event.target.value)
                  }
                  className="mt-2 w-full rounded-md border border-[#333] bg-[#202020] px-4 py-3 text-sm font-bold text-[#f5f5f5] outline-none focus:border-[#a79981]"
                >
                  {dailyRecapOptions.map((recap) => (
                    <option key={recap.value} value={recap.value}>
                      {recap.label} - {recap.description}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-bold text-[#bcbcbc]">
                    Jenis kas
                  </span>
                  <select
                    value={kasForm.method}
                    onChange={(event) =>
                      updateKasForm("method", event.target.value)
                    }
                    className="mt-2 w-full rounded-md border border-[#333] bg-[#202020] px-4 py-3 text-sm font-bold text-[#f5f5f5] outline-none focus:border-[#a79981]"
                  >
                    {kasMethodOptions.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-[#bcbcbc]">
                    Nominal kas
                  </span>
                  <div className="mt-2 flex rounded-md border border-[#333] bg-[#202020] focus-within:border-[#a79981]">
                    <span className="flex items-center px-4 text-sm font-bold text-[#a79981]">
                      Rp
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNominalInput(kasForm.amount)}
                      onChange={(event) =>
                        updateKasForm(
                          "amount",
                          normalizeNominalInput(event.target.value)
                        )
                      }
                      className="min-w-0 flex-1 bg-transparent py-3 pr-4 text-sm font-bold text-[#f5f5f5] outline-none"
                      placeholder="0"
                    />
                  </div>
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-bold text-[#bcbcbc]">
                  Catatan
                </span>
                <textarea
                  value={kasForm.note}
                  onChange={(event) => updateKasForm("note", event.target.value)}
                  className="mt-2 h-24 w-full resize-none rounded-md border border-[#333] bg-[#202020] px-4 py-3 text-sm text-[#f5f5f5] outline-none focus:border-[#a79981]"
                  placeholder="Contoh: tambah kas tunai dari admin"
                />
              </label>

              <div className="flex justify-end gap-3 border-t border-[#333] pt-4">
                <button
                  type="button"
                  onClick={() => setIsKasModalOpen(false)}
                  className="rounded-md bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5] transition hover:bg-[#404040]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={addKasMutation.isPending}
                  className="rounded-md bg-[#a79981] px-5 py-2 text-sm font-bold text-[#101010] transition hover:bg-[#b7aa94] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {addKasMutation.isPending ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Metrics;
