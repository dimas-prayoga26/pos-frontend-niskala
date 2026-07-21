import React, { useMemo, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { useSelector } from "react-redux";
import Select from "react-select";
import { addRecap, getMenuItems, getOrders, getRecaps, getUsers } from "../../https";
import { formatCurrency, getOrderReceivedAmount } from "../../utils";

const recapTabs = [
  { key: "daily", label: "Harian" },
  { key: "weekly", label: "Mingguan" },
  { key: "monthly", label: "Bulanan" },
];

const getLocalDate = (value) => {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) return null;

  return date;
};

const getDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDateLabel = (date) =>
  date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatRecapDateLabel = (value) => {
  const date = getLocalDate(value);

  return date ? formatDateLabel(date) : "-";
};

const getWeekStart = (date) => {
  const start = new Date(date);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;

  start.setDate(start.getDate() + mondayOffset);
  start.setHours(0, 0, 0, 0);

  return start;
};

const getWeekEnd = (date) => {
  const end = new Date(date);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return end;
};

const getWeekLabel = (startDate, endDate = getWeekEnd(startDate)) =>
  `${formatDateLabel(startDate)} - ${formatDateLabel(endDate)}`;

const getGroupInfo = (orderDate, activeTab) => {
  if (activeTab === "daily") {
    return {
      key: getDateKey(orderDate),
      label: formatDateLabel(orderDate),
      sortValue: new Date(orderDate).setHours(0, 0, 0, 0),
    };
  }

  if (activeTab === "weekly") {
    const weekStart = getWeekStart(orderDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    return {
      key: getDateKey(weekStart),
      label: `${formatDateLabel(weekStart)} - ${formatDateLabel(weekEnd)}`,
      sortValue: weekStart.getTime(),
    };
  }

  const monthStart = new Date(orderDate.getFullYear(), orderDate.getMonth(), 1);

  return {
    key: `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(
      2,
      "0"
    )}`,
    label: orderDate.toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
    }),
    sortValue: monthStart.getTime(),
  };
};

const getPaymentLabel = (paymentMethod) => paymentMethod || "Belum diisi";
const getPlatformLabel = (order) => {
  if (order.orderType === "Online") return order.orderPlatform || "Online";

  return "Offline";
};

const createEmptyGroup = ({ key, label, sortValue }) => ({
  key,
  label,
  sortValue,
  orderCount: 0,
  receivedRevenue: 0,
  invoiceTotal: 0,
  subtotalTotal: 0,
  offlineTotal: 0,
  onlineTotal: 0,
  cateringDp: 0,
  cateringReceivable: 0,
  paymentMethods: {},
  platforms: {},
});

const addBreakdownAmount = (target, label, amount) => {
  target[label] = (target[label] || 0) + amount;
};

const formatBreakdown = (breakdown) => {
  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);

  if (!entries.length) return "-";

  return entries
    .map(([label, value]) => `${label}: ${formatCurrency(value)}`)
    .join(" / ");
};

const getTodayInputValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getMonthInputValue = (value = new Date()) => {
  const date = getLocalDate(value) || new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
};

const formatMonthLabel = (value) => {
  const [year, month] = String(value || "").split("-").map(Number);

  if (!year || !month) return "-";

  return new Date(year, month - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
};

const normalizeNominalInput = (value) => {
  const digitsOnly = String(value).replace(/\D/g, "");

  return digitsOnly || "0";
};

const formatNominalInput = (value) =>
  Number(normalizeNominalInput(value)).toLocaleString("id-ID");

const recapFormFields = [
  { id: "date", label: "Tanggal", type: "date" },
  { id: "transactionTotal", label: "Total transaksi", type: "number" },
  { id: "offlineRevenue", label: "Omzet offline (Rp)", type: "text", currency: true },
  { id: "onlineRevenue", label: "Omzet online (Rp)", type: "text", currency: true },
  { id: "cateringRevenue", label: "Omzet catering (Rp)", type: "text", currency: true },
  { id: "hppTotal", label: "HPP Bahan (Rp)", type: "text", currency: true },
  { id: "dailyExpense", label: "Pengeluaran hari ini (Rp)", type: "text", currency: true },
  { id: "cashIn", label: "Cash masuk (Rp)", type: "text", currency: true },
  { id: "qrisIn", label: "QRIS masuk (Rp)", type: "text", currency: true },
  { id: "transferIn", label: "Transfer masuk (Rp)", type: "text", currency: true },
];

const createEmptyRecapForm = () => ({
  date: getTodayInputValue(),
  shiftOfficerId: "",
  shiftOfficer: "",
  transactionTotal: "0",
  offlineRevenue: "0",
  onlineRevenue: "0",
  cateringRevenue: "0",
  hppTotal: "0",
  dailyExpense: "0",
  cashIn: "0",
  qrisIn: "0",
  transferIn: "0",
  bestMenuItemId: "",
  bestMenu: "",
  leastMenuItemId: "",
  leastMenu: "",
  note: "",
});

const createEmptyWeeklyRecapForm = () => {
  const weekStart = getWeekStart(new Date());
  const weekEnd = getWeekEnd(weekStart);

  return {
    periodStartDate: getDateKey(weekStart),
    periodEndDate: getDateKey(weekEnd),
    operationalIssues: "",
    teamEvaluation: "",
    stockEvaluation: "",
    actionPlan: "",
  };
};

const createEmptyMonthlyRecapForm = () => ({
  periodMonth: getMonthInputValue(),
  retainedMenu: "",
  evaluatedMenu: "",
  promotionEvaluation: "",
  supplierEvaluation: "",
  nextMonthStrategy: "",
});

const isCateringOrder = (order) =>
  Boolean(order.cateringDetails) ||
  order.orderType === "Catering" ||
  order.items?.some((item) => item.categoryName === "Catering");

const createRecapFormFromOrders = (orders, date = getTodayInputValue()) => {
  const selectedDate = getLocalDate(date);
  const selectedDateKey = selectedDate ? getDateKey(selectedDate) : date;
  const dailyOrders = orders.filter((order) => {
    const orderDate = getLocalDate(order.orderDate);

    return orderDate && getDateKey(orderDate) === selectedDateKey;
  });

  const summary = dailyOrders.reduce(
    (current, order) => {
      const receivedAmount = getOrderReceivedAmount(order);
      const isCatering = isCateringOrder(order);

      if (isCatering) {
        current.cateringRevenue += receivedAmount;
      } else if (order.orderType === "Online") {
        current.onlineRevenue += receivedAmount;
      } else {
        current.offlineRevenue += receivedAmount;
      }

      return current;
    },
    {
      offlineRevenue: 0,
      onlineRevenue: 0,
      cateringRevenue: 0,
    }
  );

  return {
    ...createEmptyRecapForm(),
    date,
    transactionTotal: String(dailyOrders.length),
    offlineRevenue: String(summary.offlineRevenue),
    onlineRevenue: String(summary.onlineRevenue),
    cateringRevenue: String(summary.cateringRevenue),
  };
};

const getOrdersInRange = (orders, startDate, endDate) => {
  return orders.filter((order) => {
    const orderDate = getLocalDate(order.orderDate);

    return orderDate && orderDate >= startDate && orderDate <= endDate;
  });
};

const createWeeklySummary = ({ dailyRecaps, orders, periodStartDate, periodEndDate }) => {
  const startDate = getLocalDate(periodStartDate);
  const endDate = getLocalDate(periodEndDate);

  if (!startDate || !endDate) {
    return {
      totalOmzet: 0,
      grossProfit: 0,
      offlineRevenue: 0,
      onlineRevenue: 0,
      cateringRevenue: 0,
      cateringOrderCount: 0,
      topChannel: "-",
      recordedDays: 0,
    };
  }

  endDate.setHours(23, 59, 59, 999);

  const recapsInWeek = dailyRecaps.filter((recap) => {
    const recapDate = getLocalDate(recap.recapDate);

    return recapDate && recapDate >= startDate && recapDate <= endDate;
  });
  const ordersInWeek = getOrdersInRange(orders, startDate, endDate);
  const cateringOrderCount = ordersInWeek.filter(isCateringOrder).length;
  const summary = recapsInWeek.reduce(
    (current, recap) => ({
      totalOmzet: current.totalOmzet + (Number(recap.totalRevenue) || 0),
      grossProfit: current.grossProfit + (Number(recap.grossProfit) || 0),
      offlineRevenue: current.offlineRevenue + (Number(recap.offlineRevenue) || 0),
      onlineRevenue: current.onlineRevenue + (Number(recap.onlineRevenue) || 0),
      cateringRevenue:
        current.cateringRevenue + (Number(recap.cateringRevenue) || 0),
    }),
    {
      totalOmzet: 0,
      grossProfit: 0,
      offlineRevenue: 0,
      onlineRevenue: 0,
      cateringRevenue: 0,
    }
  );
  const channelTotals = [
    { label: "Offline", value: summary.offlineRevenue },
    { label: "Online", value: summary.onlineRevenue },
    { label: "Catering", value: summary.cateringRevenue },
  ];
  const topChannel =
    channelTotals.sort((first, second) => second.value - first.value)[0]?.label ||
    "-";

  return {
    ...summary,
    cateringOrderCount,
    topChannel,
    recordedDays: recapsInWeek.length,
  };
};

const createMonthlySummary = ({ dailyRecaps, orders, periodMonth }) => {
  const [year, month] = String(periodMonth || "").split("-").map(Number);

  if (!year || !month) {
    return {
      omzet: 0,
      hppTotal: 0,
      grossProfit: 0,
      estimatedNetProfit: 0,
      cateringOrderCount: 0,
    };
  }

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const recapsInMonth = dailyRecaps.filter((recap) => {
    const recapDate = getLocalDate(recap.recapDate);

    return recapDate && recapDate >= monthStart && recapDate <= monthEnd;
  });
  const ordersInMonth = getOrdersInRange(orders, monthStart, monthEnd);
  const summary = recapsInMonth.reduce(
    (current, recap) => {
      const totalRevenue = Number(recap.totalRevenue) || 0;
      const hppTotal = Number(recap.hppTotal) || 0;
      const grossProfit = Number(recap.grossProfit) || totalRevenue - hppTotal;
      const dailyExpense = Number(recap.dailyExpense) || 0;

      return {
        omzet: current.omzet + totalRevenue,
        hppTotal: current.hppTotal + hppTotal,
        grossProfit: current.grossProfit + grossProfit,
        estimatedNetProfit: current.estimatedNetProfit + grossProfit - dailyExpense,
      };
    },
    {
      omzet: 0,
      hppTotal: 0,
      grossProfit: 0,
      estimatedNetProfit: 0,
    }
  );

  return {
    ...summary,
    cateringOrderCount: ordersInMonth.filter(isCateringOrder).length,
  };
};

const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 40,
    height: 40,
    borderRadius: 8,
    borderColor: state.isFocused ? "#025cca" : "#333",
    backgroundColor: "#1f1f1f",
    boxShadow: "none",
    cursor: "pointer",
    ":hover": {
      borderColor: state.isFocused ? "#025cca" : "#333",
    },
  }),
  valueContainer: (base) => ({
    ...base,
    height: 40,
    padding: "0 12px",
  }),
  input: (base) => ({
    ...base,
    color: "#f5f5f5",
    margin: 0,
    padding: 0,
  }),
  singleValue: (base) => ({
    ...base,
    color: "#f5f5f5",
    fontWeight: 600,
  }),
  placeholder: (base) => ({
    ...base,
    color: "#777",
    fontWeight: 600,
  }),
  indicatorsContainer: (base) => ({
    ...base,
    height: 40,
  }),
  indicatorSeparator: () => ({
    display: "none",
  }),
  dropdownIndicator: (base) => ({
    ...base,
    color: "#ababab",
    padding: "0 10px",
    ":hover": {
      color: "#f5f5f5",
    },
  }),
  clearIndicator: (base) => ({
    ...base,
    color: "#ababab",
    padding: "0 4px",
    ":hover": {
      color: "#f5f5f5",
    },
  }),
  menu: (base) => ({
    ...base,
    zIndex: 80,
    overflow: "hidden",
    borderRadius: 8,
    border: "1px solid #333",
    backgroundColor: "#1a1a1a",
    boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.4)",
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 80,
  }),
  menuList: (base) => ({
    ...base,
    maxHeight: 192,
    padding: 0,
    backgroundColor: "#1a1a1a",
  }),
  option: (base, state) => ({
    ...base,
    padding: "12px 16px",
    color: "#f5f5f5",
    backgroundColor: state.isSelected
      ? "#025cca"
      : state.isFocused
        ? "#262626"
        : "#1a1a1a",
    cursor: "pointer",
    ":active": {
      backgroundColor: "#025cca",
    },
  }),
  noOptionsMessage: (base) => ({
    ...base,
    color: "#ababab",
  }),
};

const SelectField = ({
  label,
  value,
  onChange,
  options,
  placeholder,
  isSearchable = true,
}) => {
  const selectedOption =
    options.find((option) => String(option.value) === String(value)) || null;

  return (
    <div>
      <label className="block text-sm font-semibold text-[#ababab]">
        {label}
      </label>
      <Select
        className="mt-2"
        value={selectedOption}
        onChange={(selected) => onChange(selected?.value || "")}
        options={options}
        placeholder={placeholder}
        isSearchable={isSearchable}
        isClearable
        noOptionsMessage={() => "Tidak ada data"}
        menuPosition="fixed"
        menuPortalTarget={typeof document !== "undefined" ? document.body : null}
        styles={selectStyles}
        formatOptionLabel={(option) => (
          <div>
            <span className="block truncate font-semibold">{option.label}</span>
            {option.description && (
              <span className="mt-1 block truncate text-xs text-[#ababab]">
                {option.description}
              </span>
            )}
          </div>
        )}
      />
    </div>
  );
};

const RecapManagement = () => {
  const queryClient = useQueryClient();
  const currentUser = useSelector((state) => state.user);
  const isAdmin = currentUser.role?.toLowerCase() === "admin";
  const [activeTab, setActiveTab] = useState("daily");
  const [isRecapModalOpen, setIsRecapModalOpen] = useState(false);
  const [recapForm, setRecapForm] = useState(createEmptyRecapForm);
  const [weeklyRecapForm, setWeeklyRecapForm] = useState(
    createEmptyWeeklyRecapForm
  );
  const [monthlyRecapForm, setMonthlyRecapForm] = useState(
    createEmptyMonthlyRecapForm
  );

  const { data: ordersRes, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
    placeholderData: keepPreviousData,
  });

  const { data: savedRecapsRes, isLoading: isSavedRecapsLoading } = useQuery({
    queryKey: ["recaps", activeTab],
    queryFn: () => getRecaps(activeTab),
    placeholderData: keepPreviousData,
  });

  const { data: dailyRecapsSourceRes } = useQuery({
    queryKey: ["recaps", "daily", "weekly-source"],
    queryFn: () => getRecaps("daily"),
    placeholderData: keepPreviousData,
  });

  const orders = ordersRes?.data?.data || [];
  const savedRecaps = savedRecapsRes?.data?.data || [];
  const dailyRecapsSource = dailyRecapsSourceRes?.data?.data || [];
  const { data: usersRes } = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
    placeholderData: keepPreviousData,
    enabled: isAdmin,
  });
  const { data: menuItemsRes } = useQuery({
    queryKey: ["menu-items", "recap-options"],
    queryFn: () => getMenuItems({ includeUnavailable: true }),
    placeholderData: keepPreviousData,
  });

  const users = isAdmin
    ? usersRes?.data?.data || []
    : currentUser?._id
      ? [currentUser]
      : [];
  const menuItems = menuItemsRes?.data?.data || [];
  const userOptions = useMemo(
    () =>
      users.map((user) => ({
        value: String(user.id || user._id),
        label: user.name,
        description: user.role || user.email || "",
      })),
    [users]
  );
  const menuOptions = useMemo(
    () =>
      menuItems.map((item) => ({
        value: String(item.id || item._id),
        label: item.name,
        description:
          item.category?.name || item.categoryName || formatCurrency(item.price),
      })),
    [menuItems]
  );
  const weekOptions = useMemo(() => {
    const weekMap = new Map();
    const addWeek = (dateValue) => {
      const date = getLocalDate(dateValue);

      if (!date) return;

      const weekStart = getWeekStart(date);
      const weekEnd = getWeekEnd(weekStart);
      const value = getDateKey(weekStart);

      weekMap.set(value, {
        value,
        label: getWeekLabel(weekStart, weekEnd),
        description: "",
        periodEndDate: getDateKey(weekEnd),
      });
    };

    addWeek(new Date());
    dailyRecapsSource.forEach((recap) => addWeek(recap.recapDate));
    orders.forEach((order) => addWeek(order.orderDate));
    savedRecaps
      .filter((recap) => recap.periodStartDate)
      .forEach((recap) => addWeek(recap.periodStartDate));

    return Array.from(weekMap.values()).sort(
      (first, second) => new Date(second.value) - new Date(first.value)
    );
  }, [dailyRecapsSource, orders, savedRecaps]);
  const weeklySummary = useMemo(
    () =>
      createWeeklySummary({
        dailyRecaps: dailyRecapsSource,
        orders,
        periodStartDate: weeklyRecapForm.periodStartDate,
        periodEndDate: weeklyRecapForm.periodEndDate,
      }),
    [
      dailyRecapsSource,
      orders,
      weeklyRecapForm.periodEndDate,
      weeklyRecapForm.periodStartDate,
    ]
  );
  const monthOptions = useMemo(() => {
    const monthMap = new Map();
    const addMonth = (value) => {
      const monthValue = getMonthInputValue(value);

      monthMap.set(monthValue, {
        value: monthValue,
        label: formatMonthLabel(monthValue),
      });
    };

    addMonth(new Date());
    dailyRecapsSource.forEach((recap) => addMonth(recap.recapDate));
    orders.forEach((order) => addMonth(order.orderDate));
    savedRecaps
      .filter((recap) => recap.periodMonth)
      .forEach((recap) => addMonth(`${recap.periodMonth}-01`));

    return Array.from(monthMap.values()).sort(
      (first, second) => new Date(`${second.value}-01`) - new Date(`${first.value}-01`)
    );
  }, [dailyRecapsSource, orders, savedRecaps]);
  const monthlySummary = useMemo(
    () =>
      createMonthlySummary({
        dailyRecaps: dailyRecapsSource,
        orders,
        periodMonth: monthlyRecapForm.periodMonth,
      }),
    [dailyRecapsSource, monthlyRecapForm.periodMonth, orders]
  );

  const recapRows = useMemo(() => {
    const groups = new Map();

    orders.forEach((order) => {
      const orderDate = getLocalDate(order.orderDate);

      if (!orderDate) return;

      const groupInfo = getGroupInfo(orderDate, activeTab);
      const currentGroup =
        groups.get(groupInfo.key) || createEmptyGroup(groupInfo);
      const receivedAmount = getOrderReceivedAmount(order);
      const invoiceAmount = Number(order.bills?.totalWithTax) || 0;
      const subtotalAmount = Number(order.bills?.total) || 0;
      const cateringDetails = order.cateringDetails;
      const remainingBalance = Number(order.bills?.remainingBalance) || 0;

      currentGroup.orderCount += 1;
      currentGroup.receivedRevenue += receivedAmount;
      currentGroup.invoiceTotal += invoiceAmount;
      currentGroup.subtotalTotal += subtotalAmount;

      if (order.orderType === "Online") {
        currentGroup.onlineTotal += receivedAmount;
      } else {
        currentGroup.offlineTotal += receivedAmount;
      }

      if (cateringDetails?.paymentPlan === "DP") {
        currentGroup.cateringDp += Number(cateringDetails.dp ?? order.bills?.dp ?? 0) || 0;
      }

      if (cateringDetails && remainingBalance > 0) {
        currentGroup.cateringReceivable += remainingBalance;
      }

      addBreakdownAmount(
        currentGroup.paymentMethods,
        getPaymentLabel(order.paymentMethod),
        receivedAmount
      );
      addBreakdownAmount(
        currentGroup.platforms,
        getPlatformLabel(order),
        receivedAmount
      );

      groups.set(groupInfo.key, currentGroup);
    });

    return Array.from(groups.values()).sort((a, b) => b.sortValue - a.sortValue);
  }, [activeTab, orders]);

  const totals = recapRows.reduce(
    (summary, row) => ({
      orderCount: summary.orderCount + row.orderCount,
      receivedRevenue: summary.receivedRevenue + row.receivedRevenue,
      invoiceTotal: summary.invoiceTotal + row.invoiceTotal,
      subtotalTotal: summary.subtotalTotal + row.subtotalTotal,
      offlineTotal: summary.offlineTotal + row.offlineTotal,
      onlineTotal: summary.onlineTotal + row.onlineTotal,
      cateringReceivable: summary.cateringReceivable + row.cateringReceivable,
    }),
    {
      orderCount: 0,
      receivedRevenue: 0,
      invoiceTotal: 0,
      subtotalTotal: 0,
      offlineTotal: 0,
      onlineTotal: 0,
      cateringReceivable: 0,
    }
  );
  const cashDifference = totals.receivedRevenue - totals.invoiceTotal;
  const hppTotal = 0;
  const grossProfit = totals.invoiceTotal - hppTotal;
  const estimatedNetProfit = grossProfit;

  const summaryCards =
    activeTab === "weekly"
      ? [
          {
            title: "Total omzet",
            value: formatCurrency(totals.invoiceTotal),
            color: "#025cca",
          },
          {
            title: "Laba kotor",
            value: formatCurrency(totals.subtotalTotal),
            color: "#02a05a",
          },
          {
            title: "Offline",
            value: formatCurrency(totals.offlineTotal),
            color: "#b58105",
          },
          {
            title: "Online",
            value: formatCurrency(totals.onlineTotal),
            color: "#be3e3f",
          },
        ]
      : activeTab === "monthly"
        ? [
            {
              title: "Omzet",
              value: formatCurrency(totals.invoiceTotal),
              color: "#025cca",
            },
            {
              title: "HPP",
              value: formatCurrency(hppTotal),
              color: "#735f32",
            },
            {
              title: "Laba kotor",
              value: formatCurrency(grossProfit),
              color: "#02a05a",
            },
            {
              title: "Estimasi laba bersih",
              value: formatCurrency(estimatedNetProfit),
              color: "#7f167f",
            },
          ]
      : [
          {
            title: "Total omzet",
            value: formatCurrency(totals.invoiceTotal),
            color: "#025cca",
          },
          {
            title: "Laba kotor",
            value: formatCurrency(totals.subtotalTotal),
            color: "#02a05a",
          },
          {
            title: "Total kas masuk",
            value: formatCurrency(totals.receivedRevenue),
            color: "#b58105",
          },
          {
            title: "Selisih kas",
            value: formatCurrency(cashDifference),
            color: "#be3e3f",
          },
        ];

  const updateRecapForm = (field, value) => {
    setRecapForm((current) => ({ ...current, [field]: value }));
  };

  const updateRecapFields = (fields) => {
    setRecapForm((current) => ({ ...current, ...fields }));
  };

  const updateWeeklyRecapForm = (field, value) => {
    setWeeklyRecapForm((current) => ({ ...current, [field]: value }));
  };

  const updateMonthlyRecapForm = (field, value) => {
    setMonthlyRecapForm((current) => ({ ...current, [field]: value }));
  };

  const applyOrderSummaryToForm = (date) => {
    setRecapForm((current) => ({
      ...createRecapFormFromOrders(orders, date),
      shiftOfficerId: current.shiftOfficerId,
      shiftOfficer: current.shiftOfficer,
      hppTotal: current.hppTotal,
      dailyExpense: current.dailyExpense,
      cashIn: current.cashIn,
      qrisIn: current.qrisIn,
      transferIn: current.transferIn,
      bestMenuItemId: current.bestMenuItemId,
      bestMenu: current.bestMenu,
      leastMenuItemId: current.leastMenuItemId,
      leastMenu: current.leastMenu,
      note: current.note,
    }));
  };

  const buildDailyRecapPayload = () => ({
    date: recapForm.date,
    userId: recapForm.shiftOfficerId || null,
    shiftOfficer: recapForm.shiftOfficer,
    transactionTotal: normalizeNominalInput(recapForm.transactionTotal),
    offlineRevenue: normalizeNominalInput(recapForm.offlineRevenue),
    onlineRevenue: normalizeNominalInput(recapForm.onlineRevenue),
    cateringRevenue: normalizeNominalInput(recapForm.cateringRevenue),
    hppTotal: normalizeNominalInput(recapForm.hppTotal),
    dailyExpense: normalizeNominalInput(recapForm.dailyExpense),
    cashIn: normalizeNominalInput(recapForm.cashIn),
    qrisIn: normalizeNominalInput(recapForm.qrisIn),
    transferIn: normalizeNominalInput(recapForm.transferIn),
    bestMenuItemId: recapForm.bestMenuItemId || null,
    bestMenuName: recapForm.bestMenu,
    leastMenuItemId: recapForm.leastMenuItemId || null,
    leastMenuName: recapForm.leastMenu,
    note: recapForm.note,
  });

  const buildWeeklyRecapPayload = () => ({
    periodStartDate: weeklyRecapForm.periodStartDate,
    periodEndDate: weeklyRecapForm.periodEndDate,
    totalOmzet: weeklySummary.totalOmzet,
    grossProfit: weeklySummary.grossProfit,
    offlineRevenue: weeklySummary.offlineRevenue,
    onlineRevenue: weeklySummary.onlineRevenue,
    cateringRevenue: weeklySummary.cateringRevenue,
    cateringOrderCount: weeklySummary.cateringOrderCount,
    topChannel: weeklySummary.topChannel,
    operationalIssues: weeklyRecapForm.operationalIssues,
    teamEvaluation: weeklyRecapForm.teamEvaluation,
    stockEvaluation: weeklyRecapForm.stockEvaluation,
    actionPlan: weeklyRecapForm.actionPlan,
  });

  const buildMonthlyRecapPayload = () => ({
    periodMonth: monthlyRecapForm.periodMonth,
    omzet: monthlySummary.omzet,
    hppTotal: monthlySummary.hppTotal,
    grossProfit: monthlySummary.grossProfit,
    estimatedNetProfit: monthlySummary.estimatedNetProfit,
    cateringOrderCount: monthlySummary.cateringOrderCount,
    retainedMenu: monthlyRecapForm.retainedMenu,
    evaluatedMenu: monthlyRecapForm.evaluatedMenu,
    promotionEvaluation: monthlyRecapForm.promotionEvaluation,
    supplierEvaluation: monthlyRecapForm.supplierEvaluation,
    nextMonthStrategy: monthlyRecapForm.nextMonthStrategy,
  });

  const saveDailyRecapMutation = useMutation({
    mutationFn: (data) => addRecap({ periodType: "daily", data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recaps"] });
      enqueueSnackbar("Rekap harian berhasil disimpan", { variant: "success" });
      setRecapForm(createRecapFormFromOrders(orders));
      setActiveTab("daily");
      setIsRecapModalOpen(false);
    },
    onError: (error) => {
      enqueueSnackbar(
        error?.response?.data?.message || "Gagal menyimpan rekap harian",
        { variant: "error" }
      );
    },
  });

  const saveWeeklyRecapMutation = useMutation({
    mutationFn: (data) => addRecap({ periodType: "weekly", data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recaps"] });
      enqueueSnackbar("Rekap mingguan berhasil disimpan", {
        variant: "success",
      });
      setActiveTab("weekly");
      setIsRecapModalOpen(false);
    },
    onError: (error) => {
      enqueueSnackbar(
        error?.response?.data?.message || "Gagal menyimpan rekap mingguan",
        { variant: "error" }
      );
    },
  });

  const saveMonthlyRecapMutation = useMutation({
    mutationFn: (data) => addRecap({ periodType: "monthly", data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recaps"] });
      enqueueSnackbar("Rekap bulanan berhasil disimpan", {
        variant: "success",
      });
      setActiveTab("monthly");
      setIsRecapModalOpen(false);
    },
    onError: (error) => {
      enqueueSnackbar(
        error?.response?.data?.message || "Gagal menyimpan rekap bulanan",
        { variant: "error" }
      );
    },
  });

  const openRecapModal = () => {
    if (activeTab === "weekly") {
      const emptyWeeklyForm = createEmptyWeeklyRecapForm();
      const currentWeek =
        weekOptions.find((option) => option.value === emptyWeeklyForm.periodStartDate) ||
        weekOptions[0];

      setWeeklyRecapForm({
        ...emptyWeeklyForm,
        periodStartDate: currentWeek?.value || emptyWeeklyForm.periodStartDate,
        periodEndDate: currentWeek?.periodEndDate || emptyWeeklyForm.periodEndDate,
      });
    } else if (activeTab === "monthly") {
      const emptyMonthlyForm = createEmptyMonthlyRecapForm();
      const currentMonth =
        monthOptions.find((option) => option.value === emptyMonthlyForm.periodMonth) ||
        monthOptions[0];

      setMonthlyRecapForm({
        ...emptyMonthlyForm,
        periodMonth: currentMonth?.value || emptyMonthlyForm.periodMonth,
      });
    } else {
      setRecapForm(createRecapFormFromOrders(orders));
    }

    setIsRecapModalOpen(true);
  };

  return (
    <div className="container mx-auto rounded-lg bg-[#262626] p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#f5f5f5]">Recap</h2>
          <p className="mt-1 text-sm text-[#ababab]">
            Rekap transaksi berdasarkan periode harian, mingguan, dan bulanan.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={openRecapModal}
            className="rounded-lg bg-[#025cca] px-4 py-2 text-sm font-bold text-[#f5f5f5] hover:bg-[#0969df]"
          >
            Tambah Rekap
          </button>
          <div className="flex rounded-lg bg-[#1f1f1f] p-1">
            {recapTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-md px-4 py-2 text-sm font-bold ${
                activeTab === tab.key
                  ? "bg-[#a79981] text-[#101010]"
                  : "text-[#ababab]"
              }`}
            >
              {tab.label}
            </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 scrollbar-hide sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.title}
            className="min-h-[96px] min-w-full snap-start rounded-lg p-4 shadow-sm sm:min-w-0"
            style={{ backgroundColor: card.color }}
          >
            <p className="text-xs font-medium text-[#f5f5f5]">{card.title}</p>
            <p className="mt-2 text-2xl font-semibold text-[#f5f5f5]">
              {isLoading ? "..." : card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg bg-[#1f1f1f] p-4">
        <table className="w-full text-left text-[#f5f5f5]">
          <thead className="bg-[#333] text-[#ababab]">
            {activeTab === "daily" ? (
              <tr>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Petugas</th>
                <th className="p-3">Trans</th>
                <th className="p-3">Offline</th>
                <th className="p-3">Online</th>
                <th className="p-3">Catering</th>
                <th className="p-3">Total</th>
                <th className="p-3">HPP</th>
                <th className="p-3">Laba</th>
                <th className="p-3">Selisih kas</th>
                <th className="p-3">Menu laku</th>
                <th className="p-3">Aksi</th>
              </tr>
            ) : activeTab === "weekly" ? (
              <tr>
                <th className="p-3">Periode</th>
                <th className="p-3">Offline</th>
                <th className="p-3">Online</th>
                <th className="p-3">Catering</th>
                <th className="p-3">Total</th>
                <th className="p-3">Laba kotor</th>
                <th className="p-3">Order cat.</th>
                <th className="p-3">Channel</th>
                <th className="p-3">Action plan</th>
              </tr>
            ) : (
              <tr>
                <th className="p-3">Bulan</th>
                <th className="p-3">Omzet</th>
                <th className="p-3">HPP</th>
                <th className="p-3">Laba kotor</th>
                <th className="p-3">Laba bersih</th>
                <th className="p-3">Order cat.</th>
                <th className="p-3">Strategi bulan depan</th>
              </tr>
            )}
          </thead>
          <tbody>
            {activeTab === "daily" ? (
              <>
                {savedRecaps.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-600 hover:bg-[#333]"
                  >
                    <td className="p-4 font-semibold">
                      {formatRecapDateLabel(row.recapDate)}
                    </td>
                    <td className="p-4">{row.shiftOfficer || "-"}</td>
                    <td className="p-4">{row.transactionTotal || 0}</td>
                    <td className="p-4">{formatCurrency(row.offlineRevenue)}</td>
                    <td className="p-4">{formatCurrency(row.onlineRevenue)}</td>
                    <td className="p-4">{formatCurrency(row.cateringRevenue)}</td>
                    <td className="p-4">{formatCurrency(row.totalRevenue)}</td>
                    <td className="p-4">{formatCurrency(row.hppTotal)}</td>
                    <td className="p-4">{formatCurrency(row.grossProfit)}</td>
                    <td className="p-4">{formatCurrency(row.cashDifference)}</td>
                    <td className="p-4 min-w-[180px]">{row.bestMenu || "-"}</td>
                    <td className="p-4">-</td>
                  </tr>
                ))}
                {!isSavedRecapsLoading && savedRecaps.length === 0 && (
                  <tr>
                    <td className="p-4 text-[#ababab]" colSpan={12}>
                      Belum ada laporan - isi form di atas saat closing hari ini.
                    </td>
                  </tr>
                )}
                {isSavedRecapsLoading && (
                  <tr>
                    <td className="p-4 text-center text-[#ababab]" colSpan={12}>
                      Loading recap...
                    </td>
                  </tr>
                )}
              </>
            ) : activeTab === "weekly" ? (
              <>
                {savedRecaps.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-600 hover:bg-[#333]"
                  >
                    <td className="p-4 min-w-[200px] font-semibold">
                      {formatRecapDateLabel(row.periodStartDate)} -{" "}
                      {formatRecapDateLabel(row.periodEndDate)}
                    </td>
                    <td className="p-4">{formatCurrency(row.offlineRevenue)}</td>
                    <td className="p-4">{formatCurrency(row.onlineRevenue)}</td>
                    <td className="p-4">{formatCurrency(row.cateringRevenue)}</td>
                    <td className="p-4">{formatCurrency(row.totalOmzet)}</td>
                    <td className="p-4">{formatCurrency(row.grossProfit)}</td>
                    <td className="p-4">{row.cateringOrderCount || 0}</td>
                    <td className="p-4">{row.topChannel || "-"}</td>
                    <td className="p-4 min-w-[240px]">
                      {row.actionPlan || "-"}
                    </td>
                  </tr>
                ))}
                {!isSavedRecapsLoading && savedRecaps.length === 0 && (
                  <tr>
                    <td className="p-4 text-[#ababab]" colSpan={9}>
                      Belum ada laporan mingguan - isi form evaluasi minggu ini.
                    </td>
                  </tr>
                )}
                {isSavedRecapsLoading && (
                  <tr>
                    <td className="p-4 text-center text-[#ababab]" colSpan={9}>
                      Loading recap...
                    </td>
                  </tr>
                )}
              </>
            ) : (
              <>
                {savedRecaps.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-600 hover:bg-[#333]"
                  >
                    <td className="p-4 font-semibold">
                      {formatMonthLabel(row.periodMonth)}
                    </td>
                    <td className="p-4">{formatCurrency(row.omzet)}</td>
                    <td className="p-4">{formatCurrency(row.hppTotal)}</td>
                    <td className="p-4">{formatCurrency(row.grossProfit)}</td>
                    <td className="p-4">
                      {formatCurrency(row.estimatedNetProfit)}
                    </td>
                    <td className="p-4">{row.cateringOrderCount || 0}</td>
                    <td className="p-4 min-w-[240px]">
                      {row.nextMonthStrategy || "-"}
                    </td>
                  </tr>
                ))}
                {!isSavedRecapsLoading && savedRecaps.length === 0 && (
                  <tr>
                    <td className="p-4 text-[#ababab]" colSpan={7}>
                      Belum ada laporan bulanan - isi form strategi bulan ini.
                    </td>
                  </tr>
                )}
                {isSavedRecapsLoading && (
                  <tr>
                    <td className="p-4 text-center text-[#ababab]" colSpan={7}>
                      Loading recap...
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {isRecapModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-lg bg-[#262626] p-5 text-[#f5f5f5] shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">
                  {activeTab === "weekly"
                    ? "Input Rekap Mingguan"
                    : activeTab === "monthly"
                      ? "Input Rekap Bulanan"
                    : "Input Rekap Harian"}
                </h3>
                <p className="mt-1 text-sm text-[#ababab]">
                  {activeTab === "weekly"
                    ? "Angka otomatis dari rekap harian dan pesanan catering."
                    : activeTab === "monthly"
                      ? "Catat evaluasi dan strategi bulanan."
                    : "Catat ringkasan operasional dan kas harian."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRecapModalOpen(false)}
                className="rounded-lg bg-[#333] px-3 py-2 text-sm font-bold text-[#f5f5f5] hover:bg-[#3d3d3d]"
              >
                Tutup
              </button>
            </div>

            {activeTab === "weekly" ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();

                  if (
                    !weeklyRecapForm.periodStartDate ||
                    !weeklyRecapForm.periodEndDate
                  ) {
                    enqueueSnackbar("Periode minggu wajib dipilih", {
                      variant: "warning",
                    });
                    return;
                  }

                  saveWeeklyRecapMutation.mutate(buildWeeklyRecapPayload());
                }}
              >
                <SelectField
                  label="Pilih minggu"
                  value={weeklyRecapForm.periodStartDate}
                  onChange={(value) => {
                    const selectedWeek = weekOptions.find(
                      (option) => String(option.value) === String(value)
                    );

                    setWeeklyRecapForm((current) => ({
                      ...current,
                      periodStartDate: selectedWeek?.value || value,
                      periodEndDate:
                        selectedWeek?.periodEndDate || current.periodEndDate,
                    }));
                  }}
                  options={weekOptions}
                  placeholder="Pilih minggu"
                  isSearchable={false}
                />

                <label className="mt-4 block text-sm font-semibold text-[#ababab]">
                  Masalah operasional minggu ini
                  <textarea
                    value={weeklyRecapForm.operationalIssues}
                    onChange={(event) =>
                      updateWeeklyRecapForm(
                        "operationalIssues",
                        event.target.value
                      )
                    }
                    rows={3}
                    placeholder="Contoh: es batu habis 2 kali di jam ramai; supplier telat"
                    className="mt-2 w-full resize-none rounded-lg border border-[#333] bg-[#1f1f1f] px-3 py-3 text-sm text-[#f5f5f5] outline-none placeholder:text-[#777] focus:border-[#025cca]"
                  />
                </label>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-[#ababab]">
                    Evaluasi tim
                    <textarea
                      value={weeklyRecapForm.teamEvaluation}
                      onChange={(event) =>
                        updateWeeklyRecapForm(
                          "teamEvaluation",
                          event.target.value
                        )
                      }
                      rows={3}
                      placeholder="Contoh: kerja sama baik, kasir perlu latihan refund QRIS"
                      className="mt-2 w-full resize-none rounded-lg border border-[#333] bg-[#1f1f1f] px-3 py-3 text-sm text-[#f5f5f5] outline-none placeholder:text-[#777] focus:border-[#025cca]"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-[#ababab]">
                    Evaluasi stok
                    <textarea
                      value={weeklyRecapForm.stockEvaluation}
                      onChange={(event) =>
                        updateWeeklyRecapForm(
                          "stockEvaluation",
                          event.target.value
                        )
                      }
                      rows={3}
                      placeholder="Contoh: powder aman; ayam fillet cepat habis"
                      className="mt-2 w-full resize-none rounded-lg border border-[#333] bg-[#1f1f1f] px-3 py-3 text-sm text-[#f5f5f5] outline-none placeholder:text-[#777] focus:border-[#025cca]"
                    />
                  </label>
                </div>

                <label className="mt-4 block text-sm font-semibold text-[#ababab]">
                  Action plan minggu depan
                  <textarea
                    value={weeklyRecapForm.actionPlan}
                    onChange={(event) =>
                      updateWeeklyRecapForm("actionPlan", event.target.value)
                    }
                    rows={3}
                    placeholder="Contoh: Dimas - cek supplier cadangan - Rabu; Owner - follow up catering - Jumat"
                    className="mt-2 w-full resize-none rounded-lg border border-[#333] bg-[#1f1f1f] px-3 py-3 text-sm text-[#f5f5f5] outline-none placeholder:text-[#777] focus:border-[#025cca]"
                  />
                </label>

                <div className="mt-5 flex justify-end gap-3 border-t border-[#333] pt-4">
                  <button
                    type="button"
                    onClick={() => setIsRecapModalOpen(false)}
                    disabled={saveWeeklyRecapMutation.isPending}
                    className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5] hover:bg-[#3d3d3d]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saveWeeklyRecapMutation.isPending}
                    className="rounded-lg bg-[#025cca] px-4 py-2 text-sm font-bold text-[#f5f5f5] hover:bg-[#0969df]"
                  >
                    {saveWeeklyRecapMutation.isPending
                      ? "Menyimpan..."
                      : "Simpan Evaluasi Minggu Ini"}
                  </button>
                </div>
              </form>
            ) : activeTab === "monthly" ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();

                  if (!monthlyRecapForm.periodMonth) {
                    enqueueSnackbar("Bulan wajib dipilih", {
                      variant: "warning",
                    });
                    return;
                  }

                  saveMonthlyRecapMutation.mutate(buildMonthlyRecapPayload());
                }}
              >
                <SelectField
                  label="Pilih bulan"
                  value={monthlyRecapForm.periodMonth}
                  onChange={(value) => {
                    updateMonthlyRecapForm("periodMonth", value);
                  }}
                  options={monthOptions}
                  placeholder="Pilih bulan"
                  isSearchable={false}
                />

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="block text-sm font-semibold text-[#ababab]">
                    Menu yang perlu dipertahankan
                    <textarea
                      value={monthlyRecapForm.retainedMenu}
                      onChange={(event) =>
                        updateMonthlyRecapForm("retainedMenu", event.target.value)
                      }
                      rows={3}
                      placeholder="Contoh: Chicken Katsu RB, Kopi Gula Aren"
                      className="mt-2 w-full resize-none rounded-lg border border-[#333] bg-[#1f1f1f] px-3 py-3 text-sm text-[#f5f5f5] outline-none placeholder:text-[#777] focus:border-[#025cca]"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-[#ababab]">
                    Menu yang perlu dievaluasi
                    <textarea
                      value={monthlyRecapForm.evaluatedMenu}
                      onChange={(event) =>
                        updateMonthlyRecapForm("evaluatedMenu", event.target.value)
                      }
                      rows={3}
                      placeholder="Contoh: Beef Teriyaki RB - margin rendah"
                      className="mt-2 w-full resize-none rounded-lg border border-[#333] bg-[#1f1f1f] px-3 py-3 text-sm text-[#f5f5f5] outline-none placeholder:text-[#777] focus:border-[#025cca]"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-[#ababab]">
                    Evaluasi promosi
                    <textarea
                      value={monthlyRecapForm.promotionEvaluation}
                      onChange={(event) =>
                        updateMonthlyRecapForm(
                          "promotionEvaluation",
                          event.target.value
                        )
                      }
                      rows={3}
                      placeholder="Contoh: promo opening efektif, lanjutkan bundling"
                      className="mt-2 w-full resize-none rounded-lg border border-[#333] bg-[#1f1f1f] px-3 py-3 text-sm text-[#f5f5f5] outline-none placeholder:text-[#777] focus:border-[#025cca]"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-[#ababab]">
                    Evaluasi supplier
                    <textarea
                      value={monthlyRecapForm.supplierEvaluation}
                      onChange={(event) =>
                        updateMonthlyRecapForm(
                          "supplierEvaluation",
                          event.target.value
                        )
                      }
                      rows={3}
                      placeholder="Contoh: supplier ayam sering telat, cari cadangan"
                      className="mt-2 w-full resize-none rounded-lg border border-[#333] bg-[#1f1f1f] px-3 py-3 text-sm text-[#f5f5f5] outline-none placeholder:text-[#777] focus:border-[#025cca]"
                    />
                  </label>
                </div>

                <label className="mt-4 block text-sm font-semibold text-[#ababab]">
                  Rekomendasi strategi bulan depan
                  <textarea
                    value={monthlyRecapForm.nextMonthStrategy}
                    onChange={(event) =>
                      updateMonthlyRecapForm(
                        "nextMonthStrategy",
                        event.target.value
                      )
                    }
                    rows={3}
                    placeholder="Contoh: fokus kontrak catering rutin; aktifkan ShopeeFood"
                    className="mt-2 w-full resize-none rounded-lg border border-[#333] bg-[#1f1f1f] px-3 py-3 text-sm text-[#f5f5f5] outline-none placeholder:text-[#777] focus:border-[#025cca]"
                  />
                </label>

                <div className="mt-5 flex justify-end gap-3 border-t border-[#333] pt-4">
                  <button
                    type="button"
                    onClick={() => setIsRecapModalOpen(false)}
                    disabled={saveMonthlyRecapMutation.isPending}
                    className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5] hover:bg-[#3d3d3d]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saveMonthlyRecapMutation.isPending}
                    className="rounded-lg bg-[#025cca] px-4 py-2 text-sm font-bold text-[#f5f5f5] hover:bg-[#0969df]"
                  >
                    {saveMonthlyRecapMutation.isPending
                      ? "Menyimpan..."
                      : "Simpan Evaluasi Bulan Ini"}
                  </button>
                </div>
              </form>
            ) : (
              <form
              onSubmit={(event) => {
                event.preventDefault();

                if (!recapForm.date) {
                  enqueueSnackbar("Tanggal wajib diisi", { variant: "warning" });
                  return;
                }

                if (!recapForm.shiftOfficerId && !recapForm.shiftOfficer) {
                  enqueueSnackbar("Shift / petugas wajib dipilih", {
                    variant: "warning",
                  });
                  return;
                }

                saveDailyRecapMutation.mutate(buildDailyRecapPayload());
              }}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {recapFormFields.map((field) => (
                  <React.Fragment key={field.id}>
                    <label className="block text-sm font-semibold text-[#ababab]">
                      {field.label}
                      <input
                        value={
                          field.currency
                            ? formatNominalInput(recapForm[field.id])
                            : recapForm[field.id]
                        }
                        onChange={(event) =>
                          field.id === "date"
                            ? applyOrderSummaryToForm(event.target.value)
                            : updateRecapForm(
                                field.id,
                                field.currency
                                  ? normalizeNominalInput(event.target.value)
                                  : event.target.value
                              )
                        }
                        type={field.type}
                        min={field.type === "number" ? "0" : undefined}
                        inputMode={field.currency ? "numeric" : undefined}
                        placeholder={field.placeholder || "0"}
                        className="mt-2 h-10 w-full rounded-lg border border-[#333] bg-[#1f1f1f] px-3 text-sm text-[#f5f5f5] outline-none placeholder:text-[#777] focus:border-[#025cca]"
                      />
                    </label>

                    {field.id === "date" && (
                      <SelectField
                        label="Shift / petugas"
                        value={recapForm.shiftOfficerId}
                        onChange={(value) => {
                          const selectedUser = userOptions.find(
                            (option) => String(option.value) === String(value)
                          );

                          updateRecapFields({
                            shiftOfficerId: value,
                            shiftOfficer: selectedUser?.label || "",
                          });
                        }}
                        options={userOptions}
                        placeholder="Pilih petugas"
                        isSearchable={false}
                      />
                    )}

                    {field.id === "transferIn" && (
                      <>
                        <SelectField
                          label="Menu paling laku"
                          value={recapForm.bestMenuItemId}
                          onChange={(value) => {
                            const selectedMenu = menuOptions.find(
                              (option) => String(option.value) === String(value)
                            );

                            updateRecapFields({
                              bestMenuItemId: value,
                              bestMenu: selectedMenu?.label || "",
                            });
                          }}
                          options={menuOptions}
                          placeholder="Pilih menu"
                        />
                        <SelectField
                          label="Menu kurang laku"
                          value={recapForm.leastMenuItemId}
                          onChange={(value) => {
                            const selectedMenu = menuOptions.find(
                              (option) => String(option.value) === String(value)
                            );

                            updateRecapFields({
                              leastMenuItemId: value,
                              leastMenu: selectedMenu?.label || "",
                            });
                          }}
                          options={menuOptions}
                          placeholder="Pilih menu"
                        />
                      </>
                    )}
                  </React.Fragment>
                ))}
              </div>

              <label className="mt-4 block text-sm font-semibold text-[#ababab]">
                Catatan operasional & tindak lanjut besok
                <textarea
                  value={recapForm.note}
                  onChange={(event) => updateRecapForm("note", event.target.value)}
                  rows={3}
                  placeholder="Contoh: es batu habis jam 13.00 - besok stok dilebihkan"
                  className="mt-2 w-full resize-none rounded-lg border border-[#333] bg-[#1f1f1f] px-3 py-3 text-sm text-[#f5f5f5] outline-none placeholder:text-[#777] focus:border-[#025cca]"
                />
              </label>

              {saveDailyRecapMutation.isError && (
                <p className="mt-3 text-sm font-semibold text-red-400">
                  Gagal menyimpan recap. Cek koneksi backend lalu coba lagi.
                </p>
              )}

              <div className="mt-5 flex justify-end gap-3 border-t border-[#333] pt-4">
                <button
                  type="button"
                  onClick={() => setIsRecapModalOpen(false)}
                  disabled={saveDailyRecapMutation.isPending}
                  className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5] hover:bg-[#3d3d3d]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saveDailyRecapMutation.isPending}
                  className="rounded-lg bg-[#025cca] px-4 py-2 text-sm font-bold text-[#f5f5f5] hover:bg-[#0969df]"
                >
                  {saveDailyRecapMutation.isPending ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RecapManagement;
