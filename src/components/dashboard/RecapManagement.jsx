import OptionalTag from "../../shared/ui/OptionalTag";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { MdChevronLeft, MdChevronRight } from "react-icons/md";
import { useSelector } from "react-redux";
import {
  addRecap,
  getMenuItems,
  getOrders,
  getRecaps,
  getSemiItems,
  getStockWastes,
} from "../../https";
import OrderDateRangeFilter from "../../features/orders/components/OrderDateRangeFilter";
import {
  filterOrdersByDateRange,
  getSummaryDateRangeLabel,
} from "../../features/orders/utils/orderFilters";
import { getDailyRecapSystem, isCateringOrder } from "../../features/orders/utils/recapDaily";
import CreatableSelect2 from "../shared/CreatableSelect2";
import RecapItemCostDialog from "./RecapItemCostDialog";
import RecapOrderHistoryDialog from "./RecapOrderHistoryDialog";
import {
  formatCurrency,
  getOrderGrossRevenue,
  getOrderHppTotal,
  getOrderIncomeDeduction,
  getOrderNetRevenue,
  getOrdersHppTotal,
  isCashPayment,
  isCrewOrder,
  isOrderPlatformMatch,
  isQrPayment,
} from "../../utils";

const SHOW_HPP_FIELDS = true;

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

// Rekap is per day: one row per tanggal.
const getGroupInfo = (orderDate) => ({
  key: getDateKey(orderDate),
  label: formatDateLabel(orderDate),
  sortValue: new Date(orderDate).setHours(0, 0, 0, 0),
});

const getPaymentLabel = (paymentMethod) => paymentMethod || "Belum diisi";
const getPlatformLabel = (order) => {
  if (order.orderType === "Online") return order.orderPlatform || "Online";

  return "Offline";
};

const getNewRecapPaymentLabel = (order) =>
  order.orderType === "Online"
    ? order.orderPlatform || "Online"
    : order.paymentMethod || "-";

const createEmptyGroup = ({ key, label, sortValue }) => ({
  key,
  label,
  sortValue,
  orderCount: 0,
  receivedRevenue: 0,
  invoiceTotal: 0,
  subtotalTotal: 0,
  hppTotal: 0,
  offlineTotal: 0,
  onlineTotal: 0,
  cateringTotal: 0,
  cateringDp: 0,
  cateringReceivable: 0,
  paymentMethods: {},
  platforms: {},
});

const addBreakdownAmount = (target, label, amount) => {
  target[label] = (target[label] || 0) + amount;
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

const getMonthDateRange = (value = getMonthInputValue()) => {
  const [year, month] = String(value || "").split("-").map(Number);

  if (!year || !month) {
    return {
      startDate: "",
      endDate: "",
    };
  }

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const lastDate = String(new Date(year, month, 0).getDate()).padStart(2, "0");

  return {
    startDate: `${monthKey}-01`,
    endDate: `${monthKey}-${lastDate}`,
  };
};

const getMonthWeekInfo = (value) => {
  const date = getLocalDate(value);

  if (!date) {
    return {
      key: "unknown",
      label: "Minggu",
    };
  }

  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const getSundayWeekStart = (currentDate) => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);

    return start;
  };
  const firstWeekStart = getSundayWeekStart(monthStart);
  const currentWeekStart = getSundayWeekStart(date);
  const weekIndex =
    Math.floor(
      (currentWeekStart.getTime() - firstWeekStart.getTime()) /
        (7 * 24 * 60 * 60 * 1000)
    ) + 1;

  return {
    key: getDateKey(currentWeekStart),
    label: `Minggu-${weekIndex}`,
  };
};

const normalizeNominalInput = (value) => {
  const digitsOnly = String(value).replace(/\D/g, "");

  return digitsOnly || "0";
};

const formatNominalInput = (value) =>
  Number(normalizeNominalInput(value)).toLocaleString("id-ID");

const normalizeSystemCurrency = (value) =>
  String(Math.round(Number(value) || 0));

const recapFormFields = [
  { id: "date", label: "Tanggal", type: "date" },
  { id: "transactionTotal", label: "Total transaksi", type: "number" },
  { id: "offlineRevenue", label: "Omzet offline (Rp)", type: "text", currency: true },
  { id: "onlineRevenue", label: "Omzet online (Rp)", type: "text", currency: true },
  { id: "cateringRevenue", label: "Omzet catering (Rp)", type: "text", currency: true },
  { id: "hppTotal", label: "HPP (Rp)", type: "text", currency: true },
  { id: "dailyExpense", label: "Pengeluaran hari ini (Rp)", type: "text", currency: true },
  { id: "cashIn", label: "Cash masuk (Rp)", type: "text", currency: true },
  { id: "qrisIn", label: "QRIS masuk (Rp)", type: "text", currency: true },
  // Paid out by the online platforms (GoFood, Grab, ...), after their fee.
  { id: "onlineIn", label: "Saldo online masuk (Rp)", type: "text", currency: true },
  // No Transfer masuk input: an older recap keeps its transfer_in (sent back
  // unchanged when edited) and it still counts in Kas masuk.
];

const visibleRecapFormFields = SHOW_HPP_FIELDS
  ? recapFormFields
  : recapFormFields.filter((field) => field.id !== "hppTotal");

const createEmptyRecapForm = () => ({
  date: getTodayInputValue(),
  transactionTotal: "0",
  offlineRevenue: "0",
  onlineRevenue: "0",
  cateringRevenue: "0",
  hppTotal: "0",
  dailyExpense: "0",
  cashIn: "0",
  qrisIn: "0",
  transferIn: "0",
  onlineIn: "0",
  bestMenuItemId: "",
  bestMenu: "",
  leastMenuItemId: "",
  leastMenu: "",
  note: "",
});

// Notas of one day (YYYY-MM-DD).
const getOrdersOfDate = (orders, date) => {
  const selectedDate = getLocalDate(date);
  const selectedDateKey = selectedDate ? getDateKey(selectedDate) : date;

  return orders.filter((order) => {
    const orderDate = getLocalDate(order.orderDate);

    return orderDate && getDateKey(orderDate) === selectedDateKey;
  });
};

// Fields of the Rekap Harian form with a system amount (from the notas of
// its day): the value filled in, and the breakdown shown under it.
const getRecapSystemAmounts = (system) => ({
  transactionTotal: { value: system.transactionTotal },
  offlineRevenue: { value: system.offlineRevenue },
  onlineRevenue: { value: system.onlineRevenue },
  cateringRevenue: { value: system.cateringRevenue },
  cashIn: { value: system.cash.net },
  qrisIn: {
    value: system.qris.net,
    detail: system.qris.fee
      ? `${formatCurrency(system.qris.gross)} - MDR ${formatCurrency(system.qris.fee)}`
      : "",
  },
  onlineIn: {
    value: system.online.net,
    detail: system.online.fee
      ? `${formatCurrency(system.online.gross)} - Platform ${formatCurrency(system.online.fee)}`
      : "",
  },
});

// A new daily recap: every amount the notas of its day give, editable.
const createRecapFormFromOrders = (
  orders,
  menuItems,
  date = getTodayInputValue()
) => {
  const dailyOrders = getOrdersOfDate(orders, date);
  const system = getDailyRecapSystem(dailyOrders, menuItems);
  const amounts = Object.fromEntries(
    Object.entries(getRecapSystemAmounts(system)).map(([field, amount]) => [field, String(amount.value)])
  );

  return {
    ...createEmptyRecapForm(),
    ...amounts,
    date,
    hppTotal: normalizeSystemCurrency(getOrdersHppTotal(dailyOrders, menuItems)),
  };
};

// The system amount under a field of the Rekap Harian form, and how far the
// typed amount is from it, with a button back to it.
const RecapSystemHint = ({ label, value, system, detail, isCount, onReset }) => {
  const format = (amount) => (isCount ? `${amount} nota` : formatCurrency(amount));
  const difference = (Number(value) || 0) - system;

  return (
    <div className="mt-1 text-xs text-[#8a8a8a]">
      <p>Sistem: {format(system)}</p>
      {detail && <p>{detail}</p>}
      {difference !== 0 && (
        <p className="flex items-center gap-1 font-semibold text-amber-300">
          Selisih {difference > 0 ? "+" : "-"}
          {format(Math.abs(difference))}
          <button
            type="button"
            onClick={onReset}
            title="Pakai angka sistem"
            aria-label={`Pakai angka sistem untuk ${label}`}
            className="rounded px-1 text-sm leading-none text-[#d6c7ae] hover:bg-[#333]"
          >
            ↺
          </button>
        </p>
      )}
    </div>
  );
};

const SelectField = ({
  optional = false,
  label,
  value,
  onChange,
  options,
  placeholder,
}) => {
  const select2Options = options.map((option) => ({
    id: option.value,
    text: option.description
      ? `${option.label} - ${option.description}`
      : option.label,
  }));

  return (
    <div>
      <label className="block text-sm font-semibold text-[#ababab]">
        {label}
        {optional && <> <OptionalTag /></>}
      </label>
      <div className="mt-2">
        <CreatableSelect2
          options={select2Options}
          value={value}
          onSelect={(selected) => onChange(selected?.id || "")}
          label={label}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
};

const dailyHeadClass =
  "whitespace-nowrap px-4 py-3 text-xs font-bold uppercase text-[#9f9f9f]";
const dailyTextClass = "px-4 py-4 align-middle text-sm text-[#f5f5f5]";
const dailyAmountBaseClass =
  "block whitespace-nowrap text-right text-sm font-bold";
const dailyAmountToneClass = {
  default: "text-[#f5f5f5]",
  muted: "text-[#cfcfcf]",
  cost: "text-[#f6d365]",
  profit: "text-[#7ee0a1]",
  danger: "text-[#ff7b7b]",
};

// A promo discount is shown as a bracketed minus, e.g. (-Rp 15.000): a marker
// only, it is never taken off the income.
const formatPromoAmount = (value) =>
  value > 0 ? `(-${formatCurrency(value)})` : formatCurrency(0);

const renderDailyAmountCell = (value, tone = "default") => (
  <td className="px-4 py-4 align-middle">
    <span
      className={`${dailyAmountBaseClass} ${
        dailyAmountToneClass[tone] || dailyAmountToneClass.default
      }`}
    >
      {formatCurrency(value)}
    </span>
  </td>
);

const RecapManagement = () => {
  const queryClient = useQueryClient();
  const currentUser = useSelector((state) => state.user);
  const [recapVersion, setRecapVersion] = useState("old");
  const summaryCardsRef = useRef(null);
  const [summaryScrollState, setSummaryScrollState] = useState({
    canScrollLeft: false,
    canScrollRight: false,
  });
  const [newRecapDateRange, setNewRecapDateRange] = useState(() =>
    getMonthDateRange()
  );
  const [isRecapModalOpen, setIsRecapModalOpen] = useState(false);
  // The Rekap New row whose rincian HPP is open.
  const [costItem, setCostItem] = useState(null);
  // The Riwayat (notas) of the day in the Rekap Harian form.
  const [isRecapHistoryOpen, setIsRecapHistoryOpen] = useState(false);
  const closeRecapHistory = useCallback(() => setIsRecapHistoryOpen(false), []);
  const [pendingDailyRecapPayload, setPendingDailyRecapPayload] = useState(null);
  const [recapForm, setRecapForm] = useState(createEmptyRecapForm);

  const { data: ordersRes, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
    placeholderData: keepPreviousData,
  });

  const { data: savedRecapsRes, isLoading: isSavedRecapsLoading } = useQuery({
    queryKey: ["recaps", "daily"],
    queryFn: () => getRecaps("daily"),
    placeholderData: keepPreviousData,
  });

  // Kerugian bahan (bahan baku and bahan olahan) per day, and the
  // daily items whose leftover the daily recap writes off.
  const { data: wastesRes } = useQuery({
    queryKey: ["stock-wastes", "recap"],
    queryFn: () => getStockWastes(),
    placeholderData: keepPreviousData,
  });
  const { data: semiItemsRes } = useQuery({
    queryKey: ["semi-items", "recap"],
    queryFn: getSemiItems,
    placeholderData: keepPreviousData,
  });

  const orders = ordersRes?.data?.data || [];
  // Notas of the day being closed whose bahan olahan still wait for the Daily Prep.
  const pendingRecapDateKey = pendingDailyRecapPayload
    ? getDateKey(getLocalDate(pendingDailyRecapPayload.date))
    : "";
  const pendingHppOrderCount = pendingRecapDateKey
    ? orders.filter(
        (order) =>
          order.hppStatus === "pending" && getDateKey(getLocalDate(order.orderDate)) === pendingRecapDateKey
      ).length
    : 0;
  const savedRecaps = savedRecapsRes?.data?.data || [];
  const wasteTotalByDate = useMemo(
    () =>
      new Map(
        (wastesRes?.data?.data?.dailyTotals || []).map((day) => [
          String(day.date).slice(0, 10),
          Number(day.cost) || 0,
        ])
      ),
    [wastesRes]
  );
  const dailySemiLeftovers = (semiItemsRes?.data?.data || []).filter(
    (item) => item.resetDaily && Number(item.stock) > 0
  );
  const { data: menuItemsRes } = useQuery({
    queryKey: ["menu-items", "recap-options"],
    queryFn: () => getMenuItems({ includeUnavailable: true }),
    placeholderData: keepPreviousData,
  });

  const menuItemsData = menuItemsRes?.data?.data;
  const menuItems = useMemo(() => menuItemsData || [], [menuItemsData]);
  // Menus of a Kategori Promo, marked in Rekap New.
  const promoMenuIds = useMemo(
    () =>
      new Set(
        menuItems
          .filter((item) => item.isBundle || item.category?.isBundle)
          .map((item) => Number(item.id || item._id))
      ),
    [menuItems]
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
  const newRecapRangeLabel = getSummaryDateRangeLabel(newRecapDateRange);
  const newRecapPeriodLabel = `Periode ${newRecapRangeLabel}`;
  const newRecapMonthOrders = useMemo(
    () => filterOrdersByDateRange(orders, newRecapDateRange),
    [newRecapDateRange, orders]
  );
  const newRecapTotals = useMemo(
    () =>
      newRecapMonthOrders.reduce(
      (summary, order) => {
        const grossAmount = getOrderGrossRevenue(order);
        const netAmount = getOrderNetRevenue(order, grossAmount);
        const incomeDeduction = getOrderIncomeDeduction(order, grossAmount);

        summary.grossSales += grossAmount;
        summary.netSales += netAmount;
        summary.discounts += incomeDeduction;
        // Promo discounts (shown only: neither income nor a loss). A Konsumsi
        // Crew's lines carry the menus' value: apart from the promos.
        const discountTotal = (order.items || []).reduce(
          (total, item) => total + (Number(item.discountAmount) || 0),
          0
        );
        if (isCrewOrder(order)) summary.crew += discountTotal;
        else summary.promo += discountTotal;

        if (order.orderType !== "Online" && isCashPayment(order.paymentMethod)) {
          summary.cashSales += netAmount;
        }

        if (order.orderType !== "Online" && isQrPayment(order.paymentMethod)) {
          summary.qrSales += netAmount;
        }

        if (
          order.orderType === "Online" &&
          isOrderPlatformMatch(order, "shopeefood")
        ) {
          summary.shopeeFoodSales += netAmount;
        }

        if (
          order.orderType === "Online" &&
          isOrderPlatformMatch(order, "gofood")
        ) {
          summary.goFoodSales += netAmount;
        }

        return summary;
      },
      {
        grossSales: 0,
        netSales: 0,
        discounts: 0,
        promo: 0,
        crew: 0,
        cashSales: 0,
        qrSales: 0,
        shopeeFoodSales: 0,
        goFoodSales: 0,
      }
      ),
    [newRecapMonthOrders]
  );
  const newRecapTableRows = useMemo(
    () =>
      newRecapMonthOrders.flatMap((order) => {
        const items = Array.isArray(order.items) ? order.items : [];
        const grossRevenue = getOrderGrossRevenue(order);
        const incomeDeductionTotal = getOrderIncomeDeduction(order, grossRevenue);
        const orderDate = getLocalDate(order.orderDate);
        const weekInfo = getMonthWeekInfo(order.orderDate);
        const itemsTotal =
          items.reduce((total, item) => {
            const quantity = Number(item.quantity) || 0;
            const unitPrice = Number(item.pricePerQuantity ?? item.price) || 0;

            return total + quantity * unitPrice;
          }, 0) || grossRevenue;

        return items.map((item, index) => {
          const quantity = Number(item.quantity) || 0;
          const unitPrice = Number(item.pricePerQuantity ?? item.price) || 0;
          const totalPrice = quantity * unitPrice;
          const revenueShare =
            itemsTotal > 0
              ? totalPrice / itemsTotal
              : items.length
                ? 1 / items.length
                : 0;
          const totalIncome = grossRevenue * revenueShare;
          const incomeDeduction = incomeDeductionTotal * revenueShare;
          const netIncome = Math.max(totalIncome - incomeDeduction, 0);
          // A promo line is marked; with a discount it shows its price and
          // the discount as a minus.
          const discountAmount = Number(item.discountAmount) || 0;
          const isCrew = isCrewOrder(order);
          const isPromo =
            !isCrew &&
            (discountAmount > 0 ||
              Number(item.discountPercent) > 0 ||
              (item.bundleChoices?.length || 0) > 0 ||
              promoMenuIds.has(Number(item.menuItemId ?? item.sourceMenuItemId)));
          const listUnitPrice =
            discountAmount > 0 && quantity > 0
              ? ((Number(item.price) || 0) + discountAmount) / quantity
              : unitPrice;
          // Historical items may still carry a size/temperature label.
          const variant = String(item.variant || "").trim();
          const menuName =
            variant && variant !== item.name ? `${item.name} - ${variant}` : item.name;

          return {
            id: `${order.id || order._id || order.orderId}-${item.id || index}`,
            orderItemId: item._id,
            orderCode: order.orderId || order.orderCode || order.id || "-",
            date: order.orderDate,
            isFirstOrderItem: index === 0,
            orderItemCount: Math.max(items.length, 1),
            orderTotalIncome: grossRevenue,
            orderIncomeDeduction: incomeDeductionTotal,
            orderNetIncome: Math.max(grossRevenue - incomeDeductionTotal, 0),
            sortValue: orderDate ? orderDate.getTime() : 0,
            weekKey: weekInfo.key,
            weekLabel: weekInfo.label,
            menu: menuName || "-",
            isPromo,
            isCrew,
            discountAmount,
            listUnitPrice,
            quantity,
            unitPrice,
            totalPrice,
            totalIncome,
            paymentMethod: getNewRecapPaymentLabel(order),
            incomeDeduction,
            netIncome,
          };
        });
      }).sort((first, second) => first.sortValue - second.sortValue),
    [newRecapMonthOrders, promoMenuIds]
  );
  const newRecapDisplayRows = useMemo(() => {
    const displayRows = [];
    let currentWeekKey = "";
    let currentWeekLabel = "";
    let weeklyTotalIncome = 0;
    let weeklyNetIncome = 0;

    const pushWeeklySummary = () => {
      if (!currentWeekKey) return;

      displayRows.push({
        id: `summary-${currentWeekKey}`,
        type: "week-summary",
        weekLabel: currentWeekLabel,
        totalIncome: weeklyTotalIncome,
        netIncome: weeklyNetIncome,
      });
    };

    newRecapTableRows.forEach((row) => {
      if (currentWeekKey && row.weekKey !== currentWeekKey) {
        pushWeeklySummary();
        weeklyTotalIncome = 0;
        weeklyNetIncome = 0;
      }

      currentWeekKey = row.weekKey;
      currentWeekLabel = row.weekLabel;
      weeklyTotalIncome += row.totalIncome;
      weeklyNetIncome += row.netIncome;
      displayRows.push(row);
    });

    pushWeeklySummary();

    return displayRows;
  }, [newRecapTableRows]);
  const dailyRecapDateKeys = useMemo(
    () =>
      new Set(
        savedRecaps
          .map((recap) => {
            const recapDate = getLocalDate(recap.recapDate);
            return recapDate ? getDateKey(recapDate) : "";
          })
          .filter(Boolean)
      ),
    [savedRecaps]
  );

  const recapRows = useMemo(() => {
    const groups = new Map();

    orders.forEach((order) => {
      const orderDate = getLocalDate(order.orderDate);

      if (!orderDate) return;

      const groupInfo = getGroupInfo(orderDate);
      const currentGroup =
        groups.get(groupInfo.key) || createEmptyGroup(groupInfo);
      const grossRevenue = getOrderGrossRevenue(order);
      const netRevenue = getOrderNetRevenue(order, grossRevenue);
      const subtotalAmount = Number(order.bills?.total) || 0;
      const hppAmount = getOrderHppTotal(order, menuItems);
      const cateringDetails = order.cateringDetails;
      const remainingBalance = Number(order.bills?.remainingBalance) || 0;

      // A Konsumsi Crew is no transaksi (no sale).
      if (!isCrewOrder(order)) currentGroup.orderCount += 1;
      currentGroup.receivedRevenue += netRevenue;
      currentGroup.invoiceTotal += grossRevenue;
      currentGroup.subtotalTotal += subtotalAmount;
      currentGroup.hppTotal += hppAmount;

      if (isCateringOrder(order)) {
        currentGroup.cateringTotal += grossRevenue;
      } else if (order.orderType === "Online") {
        currentGroup.onlineTotal += grossRevenue;
      } else {
        currentGroup.offlineTotal += grossRevenue;
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
        netRevenue
      );
      addBreakdownAmount(
        currentGroup.platforms,
        getPlatformLabel(order),
        netRevenue
      );

      groups.set(groupInfo.key, currentGroup);
    });

    return Array.from(groups.values()).sort((a, b) => b.sortValue - a.sortValue);
  }, [menuItems, orders]);
  const recapRowByKey = useMemo(
    () => new Map(recapRows.map((row) => [row.key, row])),
    [recapRows]
  );
  const dailyTableRows = useMemo(() => {
    return savedRecaps.map((recap) => {
      const recapDate = getLocalDate(recap.recapDate);
      const orderGroup = recapDate ? recapRowByKey.get(getDateKey(recapDate)) : null;
      const totalRevenue = orderGroup
        ? orderGroup.invoiceTotal
        : Number(recap.totalRevenue) || 0;
      const hppTotal = orderGroup?.hppTotal ?? 0;
      const cashRecorded =
        (Number(recap.cashIn) || 0) +
        (Number(recap.qrisIn) || 0) +
        (Number(recap.transferIn) || 0) +
        (Number(recap.onlineIn) || 0);
      const dailyExpense = Number(recap.dailyExpense) || 0;

      return {
        ...recap,
        transactionTotal: orderGroup?.orderCount ?? recap.transactionTotal,
        offlineRevenue: orderGroup?.offlineTotal ?? recap.offlineRevenue,
        onlineRevenue: orderGroup?.onlineTotal ?? recap.onlineRevenue,
        cateringRevenue: orderGroup?.cateringTotal ?? recap.cateringRevenue,
        totalRevenue,
        hppTotal,
        grossProfit: totalRevenue - hppTotal,
        dailyExpense,
        wasteTotal: wasteTotalByDate.get(String(recap.recapDate).slice(0, 10)) || 0,
        cashRecorded,
        netCash: cashRecorded - dailyExpense,
      };
    });
  }, [recapRowByKey, savedRecaps, wasteTotalByDate]);

  const totals = recapRows.reduce(
    (summary, row) => ({
      orderCount: summary.orderCount + row.orderCount,
      receivedRevenue: summary.receivedRevenue + row.receivedRevenue,
      invoiceTotal: summary.invoiceTotal + row.invoiceTotal,
      subtotalTotal: summary.subtotalTotal + row.subtotalTotal,
      hppTotal: summary.hppTotal + row.hppTotal,
      offlineTotal: summary.offlineTotal + row.offlineTotal,
      onlineTotal: summary.onlineTotal + row.onlineTotal,
      cateringTotal: summary.cateringTotal + row.cateringTotal,
      cateringReceivable: summary.cateringReceivable + row.cateringReceivable,
    }),
    {
      orderCount: 0,
      receivedRevenue: 0,
      invoiceTotal: 0,
      subtotalTotal: 0,
      hppTotal: 0,
      offlineTotal: 0,
      onlineTotal: 0,
      cateringTotal: 0,
      cateringReceivable: 0,
    }
  );
  const dailyCashRecordedTotal = dailyTableRows.reduce(
    (total, row) =>
      total +
      (Number(row.cashRecorded) ||
        (Number(row.cashIn) || 0) +
          (Number(row.qrisIn) || 0) +
          (Number(row.transferIn) || 0) +
          (Number(row.onlineIn) || 0)),
    0
  );
  const dailyExpenseTotal = dailyTableRows.reduce(
    (total, row) => total + (Number(row.dailyExpense) || 0),
    0
  );
  const cashReceivedTotal = dailyCashRecordedTotal;
  const netCashTotal = cashReceivedTotal - dailyExpenseTotal;
  const hppTotal = totals.hppTotal;
  const grossProfit = totals.invoiceTotal - hppTotal;

  const oldSummaryCards = [
    {
      title: "Total omzet",
      value: formatCurrency(totals.invoiceTotal),
      color: "#025cca",
    },
    ...(SHOW_HPP_FIELDS
      ? [
          {
            title: "Laba kotor",
            value: formatCurrency(grossProfit),
            color: "#02a05a",
          },
        ]
      : [
          {
            title: "Pengeluaran",
            value: formatCurrency(dailyExpenseTotal),
            color: "#be3e3f",
          },
        ]),
    {
      title: "Kas masuk tercatat",
      value: formatCurrency(cashReceivedTotal),
      color: "#b58105",
    },
    {
      title: "Untung bersih",
      value: formatCurrency(netCashTotal),
      color: netCashTotal < 0 ? "#be3e3f" : "#7f167f",
    },
  ];
  const newSummaryCards = [
    {
      title: `Total Penjualan ${newRecapRangeLabel}`,
      value: formatCurrency(newRecapTotals.grossSales),
      color: "#025cca",
    },
    {
      title: `Total Penjualan Bersih ${newRecapRangeLabel}`,
      value: formatCurrency(newRecapTotals.netSales),
      color: "#02a05a",
    },
    {
      title: "Total Potongan",
      value: formatCurrency(newRecapTotals.discounts),
      color: "#b58105",
    },
    {
      title: "Total Promo",
      value: formatPromoAmount(newRecapTotals.promo),
      color: "#be3e3f",
    },
    {
      // The menus the crew ate, at their normal price (no income).
      title: "Konsumsi Crew",
      value: formatPromoAmount(newRecapTotals.crew),
      color: "#0e7490",
    },
    {
      title: "Total Penjualan dengan Tunai",
      value: formatCurrency(newRecapTotals.cashSales),
      color: "#7f167f",
    },
    {
      title: "Total Penjualan dengan QR",
      value: formatCurrency(newRecapTotals.qrSales),
      color: "#0f766e",
    },
    {
      title: "Total Penjualan ShopeeFood",
      value: formatCurrency(newRecapTotals.shopeeFoodSales),
      color: "#d95f02",
    },
    {
      title: "Total Penjualan GoFood",
      value: formatCurrency(newRecapTotals.goFoodSales),
      color: "#178a4c",
    },
  ];
  const summaryCards = recapVersion === "new" ? newSummaryCards : oldSummaryCards;
  const summaryCardsContainerClass =
    recapVersion === "new"
      ? "flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 scrollbar-hide"
      : "flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 scrollbar-hide sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 xl:grid-cols-4";
  const summaryCardClass =
    recapVersion === "new"
      ? "min-h-[96px] min-w-full shrink-0 snap-start rounded-lg p-4 shadow-sm sm:min-w-[calc((100%-1rem)/2)] lg:min-w-[calc((100%-3rem)/4)]"
      : "min-h-[96px] min-w-full snap-start rounded-lg p-4 shadow-sm sm:min-w-0";
  const updateSummaryScrollState = useCallback(() => {
    const container = summaryCardsRef.current;

    if (!container) return;

    setSummaryScrollState({
      canScrollLeft: container.scrollLeft > 4,
      canScrollRight:
        container.scrollLeft + container.clientWidth < container.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    updateSummaryScrollState();
    window.addEventListener("resize", updateSummaryScrollState);

    return () => window.removeEventListener("resize", updateSummaryScrollState);
  }, [updateSummaryScrollState, recapVersion, summaryCards.length]);

  const scrollSummaryCards = (direction) => {
    const container = summaryCardsRef.current;

    if (!container) return;

    const firstCard = container.firstElementChild;
    const cardGap = 16;
    const step = firstCard
      ? firstCard.getBoundingClientRect().width + cardGap
      : container.clientWidth;

    container.scrollBy({ left: direction * step, behavior: "smooth" });
  };
  const isSummaryScrollable =
    summaryScrollState.canScrollLeft || summaryScrollState.canScrollRight;
  const summaryScrollButtonClass =
    "mb-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#444] bg-[#262626] text-[#f5f5f5] transition hover:bg-[#333] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-[#262626]";
  const activeRecapTitle = "Rekap Harian";
  const activeRecapDescription = "Daftar rekap transaksi, kas, HPP, dan menu terlaris harian.";

  const updateRecapForm = (field, value) => {
    setRecapForm((current) => ({ ...current, [field]: value }));
  };

  const updateRecapFields = (fields) => {
    setRecapForm((current) => ({ ...current, ...fields }));
  };


  const applyOrderSummaryToForm = (date) => {
    setRecapForm((current) => ({
      // Another day: its own system amounts (cash, QRIS and online too).
      ...createRecapFormFromOrders(orders, menuItems, date),
      dailyExpense: current.dailyExpense,
      transferIn: current.transferIn,
      bestMenuItemId: current.bestMenuItemId,
      bestMenu: current.bestMenu,
      leastMenuItemId: current.leastMenuItemId,
      leastMenu: current.leastMenu,
      note: current.note,
    }));
  };

  const buildDailyRecapPayload = () => {
    const dailyOrders = getOrdersOfDate(orders, recapForm.date);

    return {
      date: recapForm.date,
      // The petugas is the account logged in.
      userId: currentUser?._id || null,
      shiftOfficer: currentUser?.name || "",
      transactionTotal: normalizeNominalInput(recapForm.transactionTotal),
      offlineRevenue: normalizeNominalInput(recapForm.offlineRevenue),
      onlineRevenue: normalizeNominalInput(recapForm.onlineRevenue),
      cateringRevenue: normalizeNominalInput(recapForm.cateringRevenue),
      hppTotal: normalizeSystemCurrency(getOrdersHppTotal(dailyOrders, menuItems)),
      dailyExpense: normalizeNominalInput(recapForm.dailyExpense),
      cashIn: normalizeNominalInput(recapForm.cashIn),
      qrisIn: normalizeNominalInput(recapForm.qrisIn),
      transferIn: normalizeNominalInput(recapForm.transferIn),
      onlineIn: normalizeNominalInput(recapForm.onlineIn),
      bestMenuItemId: recapForm.bestMenuItemId || null,
      bestMenuName: recapForm.bestMenu,
      leastMenuItemId: recapForm.leastMenuItemId || null,
      leastMenuName: recapForm.leastMenu,
      note: recapForm.note,
    };
  };

  const saveDailyRecapMutation = useMutation({
    mutationFn: (data) => addRecap({ periodType: "daily", data }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["recaps"] });
      // The recap wrote off the leftover of daily bahan olahan.
      queryClient.invalidateQueries({ queryKey: ["semi-items"] });
      queryClient.invalidateQueries({ queryKey: ["stock-wastes"] });
      // ...and locked the HPP of its notas (Modul 2).
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      enqueueSnackbar("Rekap harian berhasil disimpan", { variant: "success" });
      const hppClosed = response?.data?.data?.hppClosed;
      if (hppClosed?.closedOrders > 0) {
        enqueueSnackbar(
          `HPP ${hppClosed.closedOrders} nota dikunci${
            hppClosed.items?.length
              ? `: ${hppClosed.items
                  .map(
                    (item) =>
                      `${item.name} ${formatCurrency(item.unitCost)}/${item.unit || "porsi"} (${
                        item.source === "dapur" ? "Daily Prep" : "HPP saat dijual"
                      })`
                  )
                  .join(", ")}`
              : ""
          }.`,
          { variant: "info" }
        );
      }
      const writtenOff = response?.data?.data?.writtenOff || [];
      if (writtenOff.length) {
        enqueueSnackbar(
          `Sisa dibuang: ${writtenOff
            .map((item) => `${item.name} ${Number(item.quantity).toLocaleString("id-ID")}`)
            .join(", ")} (kerugian ${formatCurrency(
            writtenOff.reduce((total, item) => total + Number(item.cost || 0), 0)
          )}).`,
          { variant: "info" }
        );
      }
      setRecapForm(createRecapFormFromOrders(orders, menuItems));
      setPendingDailyRecapPayload(null);
      setIsRecapModalOpen(false);
    },
    onError: (error) => {
      enqueueSnackbar(
        error?.response?.data?.message || "Gagal menyimpan rekap harian",
        { variant: "error" }
      );
    },
  });

  const openRecapModal = () => {
    setRecapForm(createRecapFormFromOrders(orders, menuItems));
    setIsRecapModalOpen(true);
  };

  const closeDailyConfirmModal = () => {
    if (saveDailyRecapMutation.isPending) return;

    setPendingDailyRecapPayload(null);
  };

  const submitDailyRecap = () => {
    if (!recapForm.date) {
      enqueueSnackbar("Tanggal wajib diisi", { variant: "warning" });
      return;
    }

    if (!currentUser?._id && !currentUser?.name) {
      enqueueSnackbar("Login dulu untuk menyimpan rekap", {
        variant: "warning",
      });
      return;
    }

    const selectedDate = getLocalDate(recapForm.date);
    const selectedDateKey = selectedDate ? getDateKey(selectedDate) : recapForm.date;

    if (dailyRecapDateKeys.has(selectedDateKey)) {
      enqueueSnackbar(
        "Rekap harian untuk tanggal ini sudah dibuat. Kamu tidak bisa membuat rekap harian lagi di tanggal yang sama.",
        { variant: "warning" }
      );
      return;
    }

    setPendingDailyRecapPayload(buildDailyRecapPayload());
  };

  // System amounts of the day in the open Rekap Harian form.
  const recapSystem = isRecapModalOpen
    ? getDailyRecapSystem(getOrdersOfDate(orders, recapForm.date), menuItems)
    : null;
  const recapSystemAmounts = recapSystem ? getRecapSystemAmounts(recapSystem) : {};

  return (
    <div className="container mx-auto rounded-lg bg-[#262626] p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold text-[#f5f5f5]">Rekap</h2>
            <div className="flex rounded-lg bg-[#1f1f1f] p-1">
              {[
                { key: "old", label: "Old" },
                { key: "new", label: "New" },
              ].map((version) => (
                <button
                  key={version.key}
                  type="button"
                  onClick={() => setRecapVersion(version.key)}
                  className={`rounded-md px-3 py-1 text-xs font-bold transition ${
                    recapVersion === version.key
                      ? "bg-[#a79981] text-[#101010]"
                      : "text-[#ababab] hover:text-[#f5f5f5]"
                  }`}
                >
                  {version.label}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-1 text-sm text-[#ababab]">
            Rekap transaksi harian.
          </p>
        </div>
        {recapVersion === "new" && (
          <OrderDateRangeFilter
            dateRange={newRecapDateRange}
            onChange={setNewRecapDateRange}
          />
        )}
      </div>

      <div className="flex items-center gap-2">
        {isSummaryScrollable && (
          <button
            type="button"
            onClick={() => scrollSummaryCards(-1)}
            disabled={!summaryScrollState.canScrollLeft}
            className={summaryScrollButtonClass}
            aria-label="Geser kartu ke kiri"
          >
            <MdChevronLeft size={22} />
          </button>
        )}
        <div
          ref={summaryCardsRef}
          onScroll={updateSummaryScrollState}
          className={`min-w-0 flex-1 ${summaryCardsContainerClass}`}
        >
          {summaryCards.map((card) => (
            <div
              key={card.title}
              className={summaryCardClass}
              style={{ backgroundColor: card.color }}
            >
              <p className="text-xs font-medium leading-snug text-[#f5f5f5]">
                {card.title}
              </p>
              <p
                className={`mt-2 font-semibold text-[#f5f5f5] ${
                  recapVersion === "new" ? "text-xl" : "text-2xl"
                }`}
              >
                {isLoading ? "..." : card.value}
              </p>
            </div>
          ))}
        </div>
        {isSummaryScrollable && (
          <button
            type="button"
            onClick={() => scrollSummaryCards(1)}
            disabled={!summaryScrollState.canScrollRight}
            className={summaryScrollButtonClass}
            aria-label="Geser kartu ke kanan"
          >
            <MdChevronRight size={22} />
          </button>
        )}
      </div>

      <div className="mt-6 rounded-lg bg-[#1f1f1f] p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#f5f5f5]">
              {recapVersion === "new" ? newRecapPeriodLabel : activeRecapTitle}
            </h3>
            {recapVersion === "old" && (
              <p className="mt-1 text-sm text-[#ababab]">
                {activeRecapDescription}
              </p>
            )}
          </div>
          {recapVersion === "old" && (
            <button
              type="button"
              onClick={openRecapModal}
              className="rounded-lg bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010] hover:bg-[#b7aa94]"
            >
              Tambah Rekap
            </button>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg border border-[#303030] scrollbar-hide">
        <table
          className={`w-full border-collapse text-left text-[#f5f5f5] ${
            recapVersion === "new" ? "min-w-[1220px]" : "min-w-[1380px]"
          }`}
        >
          <thead className="bg-[#2b2b2b] text-[#ababab]">
            {recapVersion === "new" ? (
              <tr>
                <th className={`${dailyHeadClass} text-left`}>Tanggal</th>
                <th className={`${dailyHeadClass} text-left`}>Menu</th>
                <th className={`${dailyHeadClass} text-center`}>Qty</th>
                <th className={`${dailyHeadClass} text-right`}>Harga</th>
                <th className={`${dailyHeadClass} text-right`}>Total harga</th>
                <th className={`${dailyHeadClass} text-right`}>
                  Total pendapatan
                </th>
                <th className={`${dailyHeadClass} text-left`}>Payment</th>
                <th className={`${dailyHeadClass} text-right`}>
                  Potongan pendapatan
                </th>
                <th className={`${dailyHeadClass} text-right`}>
                  Pendapatan bersih
                </th>
              </tr>
            ) : (
              <tr>
                <th className={`${dailyHeadClass} text-left`}>Tanggal</th>
                <th className={`${dailyHeadClass} text-left`}>Petugas</th>
                <th className={`${dailyHeadClass} text-center`}>Transaksi</th>
                <th className={`${dailyHeadClass} text-right`}>Offline</th>
                <th className={`${dailyHeadClass} text-right`}>Online</th>
                <th className={`${dailyHeadClass} text-right`}>Catering</th>
                <th className={`${dailyHeadClass} text-right`}>Omzet</th>
                {SHOW_HPP_FIELDS && (
                  <th className={`${dailyHeadClass} text-right`}>HPP</th>
                )}
                {SHOW_HPP_FIELDS && (
                  <th className={`${dailyHeadClass} text-right`}>
                    Untung kotor
                  </th>
                )}
                <th className={`${dailyHeadClass} text-right`}>Pengeluaran</th>
                <th className={`${dailyHeadClass} text-right`}>Kerugian bahan</th>
                {/* Kas masuk − omzet: what Biaya Platform and MDR QRIS took off. */}
                <th className={`${dailyHeadClass} text-right`}>Potongan Platform &amp; QRIS</th>
                {/* Kas masuk − pengeluaran (named by the user; HPP not taken off). */}
                <th className={`${dailyHeadClass} text-right`}>Untung bersih</th>
                <th className={`${dailyHeadClass} text-left`}>Menu laku</th>
                <th className={`${dailyHeadClass} text-center`}>Aksi</th>
              </tr>
            )}
          </thead>
          <tbody>
            {recapVersion === "new" ? (
              <>
                {newRecapDisplayRows.map((row) =>
                  row.type === "week-summary" ? (
                    <tr key={row.id} className="bg-[#d8bc72] text-[#101010]">
                      <td
                        className="px-4 py-3 text-center text-sm font-extrabold"
                        colSpan={5}
                      >
                        {row.weekLabel}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-extrabold">
                        {formatCurrency(row.totalIncome)}
                      </td>
                      <td className="px-4 py-3" colSpan={2}></td>
                      <td className="px-4 py-3 text-right text-sm font-extrabold">
                        {formatCurrency(row.netIncome)}
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={row.id}
                      className="border-b border-[#303030] bg-[#1f1f1f] transition-colors last:border-0 hover:bg-[#272727]"
                    >
                      {row.isFirstOrderItem && (
                        <td
                          className="min-w-[130px] border-r border-[#303030] px-4 py-4 align-middle"
                          rowSpan={row.orderItemCount}
                        >
                          <span className="block whitespace-nowrap text-sm font-bold text-[#f5f5f5]">
                            {formatRecapDateLabel(row.date)}
                          </span>
                          <span className="mt-1 block text-xs font-semibold text-[#7f7f7f]">
                            {row.orderItemCount} menu
                          </span>
                        </td>
                      )}
                      <td className="min-w-[220px] px-4 py-4 align-middle">
                        <div className="flex items-center gap-2">
                          {row.orderItemId ? (
                            <button
                              type="button"
                              onClick={() => setCostItem(row)}
                              title="Lihat rincian HPP"
                              className="block max-w-[240px] truncate text-left text-sm font-semibold text-[#f5f5f5] underline-offset-4 hover:text-[#f6d365] hover:underline"
                            >
                              {row.menu}
                            </button>
                          ) : (
                            <span className="block max-w-[240px] truncate text-sm font-semibold text-[#f5f5f5]">
                              {row.menu}
                            </span>
                          )}
                          {row.isPromo && (
                            <span className="shrink-0 rounded-md bg-amber-900/50 px-2 py-0.5 text-xs font-bold text-amber-200">
                              Promo
                            </span>
                          )}
                          {row.isCrew && (
                            <span className="shrink-0 rounded-md bg-sky-900/50 px-2 py-0.5 text-xs font-bold text-sky-200">
                              Crew
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center align-middle">
                        <span className="inline-flex min-w-[44px] justify-center rounded-md bg-[#303030] px-2.5 py-1 text-sm font-bold text-[#f5f5f5]">
                          {row.quantity}
                        </span>
                      </td>
                      {renderDailyAmountCell(row.listUnitPrice, "muted")}
                      {row.discountAmount > 0
                        ? (
                          <td className="px-4 py-4 align-middle">
                            <span
                              className={`${dailyAmountBaseClass} ${dailyAmountToneClass.danger}`}
                            >
                              {formatPromoAmount(row.discountAmount)}
                            </span>
                          </td>
                        )
                        : renderDailyAmountCell(row.totalPrice)}
                      {row.isFirstOrderItem && (
                        <td
                          className="border-l border-[#303030] px-4 py-4 align-middle"
                          rowSpan={row.orderItemCount}
                        >
                          <span className="block whitespace-nowrap text-right text-sm font-bold text-[#f5f5f5]">
                            {formatCurrency(row.orderTotalIncome)}
                          </span>
                        </td>
                      )}
                      {row.isFirstOrderItem && (
                        <td
                          className="min-w-[140px] px-4 py-4 align-middle"
                          rowSpan={row.orderItemCount}
                        >
                          <span className="block max-w-[160px] truncate text-sm font-semibold text-[#f5f5f5]">
                            {row.paymentMethod}
                          </span>
                        </td>
                      )}
                      {row.isFirstOrderItem && (
                        <td className="px-4 py-4 align-middle" rowSpan={row.orderItemCount}>
                          <span className="block whitespace-nowrap text-right text-sm font-bold text-[#ff7b7b]">
                            {formatCurrency(row.orderIncomeDeduction)}
                          </span>
                        </td>
                      )}
                      {row.isFirstOrderItem && (
                        <td className="px-4 py-4 align-middle" rowSpan={row.orderItemCount}>
                          <span className="block whitespace-nowrap text-right text-sm font-bold text-[#7ee0a1]">
                            {formatCurrency(row.orderNetIncome)}
                          </span>
                        </td>
                      )}
                    </tr>
                  )
                )}
                {!isLoading && newRecapTableRows.length === 0 && (
                  <tr>
                    <td className="p-4 text-[#ababab]" colSpan={9}>
                      Belum ada transaksi pada {newRecapRangeLabel}.
                    </td>
                  </tr>
                )}
                {isLoading && (
                  <tr>
                    <td className="p-4 text-center text-[#ababab]" colSpan={9}>
                      Loading recap...
                    </td>
                  </tr>
                )}
              </>
            ) : (
              <>
                {dailyTableRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[#303030] bg-[#1f1f1f] transition-colors last:border-0 hover:bg-[#272727]"
                  >
                    <td className="min-w-[120px] px-4 py-4 align-middle">
                      <span className="block whitespace-nowrap text-sm font-bold text-[#f5f5f5]">
                        {formatRecapDateLabel(row.recapDate)}
                      </span>
                      <span className="mt-1 block text-xs text-[#7f7f7f]">
                        Closing
                      </span>
                    </td>
                    <td className={`${dailyTextClass} min-w-[120px]`}>
                      <span className="block max-w-[140px] truncate font-semibold">
                        {row.shiftOfficer || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center align-middle">
                      <span className="inline-flex min-w-[44px] justify-center rounded-md bg-[#303030] px-2.5 py-1 text-sm font-bold text-[#f5f5f5]">
                        {row.transactionTotal || 0}
                      </span>
                    </td>
                    {renderDailyAmountCell(row.offlineRevenue, "muted")}
                    {renderDailyAmountCell(row.onlineRevenue, "muted")}
                    {renderDailyAmountCell(row.cateringRevenue, "muted")}
                    {renderDailyAmountCell(row.totalRevenue)}
                    {SHOW_HPP_FIELDS && renderDailyAmountCell(row.hppTotal, "cost")}
                    {SHOW_HPP_FIELDS &&
                      renderDailyAmountCell(row.grossProfit, "profit")}
                    {renderDailyAmountCell(row.dailyExpense, "danger")}
                    {renderDailyAmountCell(row.wasteTotal, "danger")}
                    {renderDailyAmountCell(
                      row.cashDifference,
                      Number(row.cashDifference) < 0 ? "danger" : "muted"
                    )}
                    {renderDailyAmountCell(
                      row.netCash,
                      Number(row.netCash) < 0 ? "danger" : "profit"
                    )}
                    <td className="min-w-[180px] px-4 py-4 align-middle">
                      {row.bestMenu ? (
                        <span className="inline-flex max-w-[190px] truncate rounded-md bg-[#123525] px-2.5 py-1 text-sm font-semibold text-[#8cf3b5]">
                          {row.bestMenu}
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-[#7f7f7f]">
                          -
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center align-middle text-sm font-semibold text-[#7f7f7f]">
                      -
                    </td>
                  </tr>
                ))}
                {!isSavedRecapsLoading && savedRecaps.length === 0 && (
                  <tr>
                    <td
                      className="p-4 text-[#ababab]"
                      colSpan={SHOW_HPP_FIELDS ? 15 : 13}
                    >
                      Belum ada laporan - isi form di atas saat closing hari ini.
                    </td>
                  </tr>
                )}
                {isSavedRecapsLoading && (
                  <tr>
                    <td
                      className="p-4 text-center text-[#ababab]"
                      colSpan={SHOW_HPP_FIELDS ? 15 : 13}
                    >
                      Loading recap...
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {costItem && <RecapItemCostDialog item={costItem} onClose={() => setCostItem(null)} />}

      {isRecapModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-lg bg-[#262626] p-5 text-[#f5f5f5] shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">
                  Input Rekap Harian
                </h3>
                <p className="mt-1 text-sm text-[#ababab]">
                  Catat ringkasan operasional dan kas harian.
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

              <form
              onSubmit={(event) => {
                event.preventDefault();
                submitDailyRecap();
              }}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {visibleRecapFormFields.map((field) => (
                  <React.Fragment key={field.id}>
                    <div className="relative">
                    {field.id === "transactionTotal" && (
                      // Every nota of the day (the omzet fields add them up).
                      <button
                        type="button"
                        onClick={() => setIsRecapHistoryOpen(true)}
                        className="absolute right-0 top-0 text-xs font-semibold text-[#d6c7ae] underline underline-offset-2 hover:text-white"
                      >
                        Riwayat
                      </button>
                    )}
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
                        readOnly={field.id === "hppTotal"}
                        type={field.type}
                        min={field.type === "number" ? "0" : undefined}
                        inputMode={field.currency ? "numeric" : undefined}
                        placeholder={field.placeholder || "0"}
                        className={`mt-2 h-10 w-full rounded-lg border px-3 text-sm outline-none placeholder:text-[#777] ${
                          field.id === "hppTotal"
                            ? "border-[#333] bg-[#26210f] text-[#f6d365] focus:border-[#025cca]"
                            : field.id === "dailyExpense"
                              ? // Money going out: danger.
                                "border-red-500/40 bg-red-950/40 text-red-300 focus:border-red-400"
                              : "border-[#333] bg-[#1f1f1f] text-[#f5f5f5] focus:border-[#025cca]"
                        }`}
                      />
                    </label>
                    {recapSystemAmounts[field.id] && (
                      <RecapSystemHint
                        label={field.label}
                        value={normalizeNominalInput(recapForm[field.id])}
                        system={recapSystemAmounts[field.id].value}
                        detail={recapSystemAmounts[field.id].detail}
                        isCount={field.id === "transactionTotal"}
                        onReset={() =>
                          updateRecapForm(field.id, String(recapSystemAmounts[field.id].value))
                        }
                      />
                    )}
                    </div>

                    {field.id === "date" && (
                      // The account logged in is the petugas of the recap.
                      <label className="block text-sm font-semibold text-[#ababab]">
                        Shift / petugas <OptionalTag />
                        <input
                          value={currentUser?.name || "-"}
                          readOnly
                          className="mt-2 h-10 w-full cursor-default rounded-lg border border-[#333] bg-[#1a1a1a] px-3 text-sm text-[#d6d6d6] outline-none"
                        />
                      </label>
                    )}

                    {field.id === "onlineIn" && (
                      <>
                        <SelectField
                          label="Menu paling laku"
                          optional
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
                          optional
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
                Catatan operasional & tindak lanjut besok <OptionalTag />
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
                  className="rounded-lg bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010] hover:bg-[#b7aa94]"
                >
                  {saveDailyRecapMutation.isPending ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
              </form>
          </div>
        </div>
      )}
      {isRecapModalOpen && isRecapHistoryOpen && recapSystem && (
        <RecapOrderHistoryDialog
          dateLabel={formatRecapDateLabel(recapForm.date)}
          system={recapSystem}
          onClose={closeRecapHistory}
        />
      )}
      {pendingDailyRecapPayload && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-lg rounded-lg border border-[#3a3a3a] bg-[#262626] p-5 text-[#f5f5f5] shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">Simpan Rekap Harian?</h3>
                <p className="mt-1 text-sm text-[#ababab]">
                  Setelah disimpan, pesanan pada tanggal ini akan dikunci.
                </p>
                {pendingHppOrderCount > 0 && (
                  <p className="mt-2 rounded-md bg-[#26210f] px-3 py-2 text-xs text-[#f6d365]">
                    {pendingHppOrderCount} nota HPP-nya masih pending (bahan olahan). Saat disimpan, HPP dikunci memakai
                    Daily Prep (Catat Masak) tanggal ini, atau HPP saat dijual bila dapur belum mencatat.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={closeDailyConfirmModal}
                disabled={saveDailyRecapMutation.isPending}
                className="rounded-lg bg-[#333] px-3 py-2 text-sm font-bold text-[#f5f5f5] hover:bg-[#3d3d3d] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Tutup
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-[#333] bg-[#1f1f1f] p-3">
                <p className="text-xs font-semibold text-[#ababab]">Tanggal</p>
                <p className="mt-1 text-sm font-bold">
                  {formatRecapDateLabel(pendingDailyRecapPayload.date)}
                </p>
              </div>
              <div className="rounded-lg border border-[#333] bg-[#1f1f1f] p-3">
                <p className="text-xs font-semibold text-[#ababab]">Transaksi</p>
                <p className="mt-1 text-sm font-bold">
                  {pendingDailyRecapPayload.transactionTotal}
                </p>
              </div>
              <div className="rounded-lg border border-[#333] bg-[#1f1f1f] p-3">
                <p className="text-xs font-semibold text-[#ababab]">Omzet</p>
                <p className="mt-1 text-sm font-bold">
                  {formatCurrency(
                    Number(pendingDailyRecapPayload.offlineRevenue) +
                      Number(pendingDailyRecapPayload.onlineRevenue) +
                      Number(pendingDailyRecapPayload.cateringRevenue)
                  )}
                </p>
              </div>
              {SHOW_HPP_FIELDS && (
                <div className="rounded-lg border border-[#4a390b] bg-[#26210f] p-3">
                  <p className="text-xs font-semibold text-[#f6d365]">HPP</p>
                  <p className="mt-1 text-sm font-bold text-[#f6d365]">
                    {formatCurrency(pendingDailyRecapPayload.hppTotal)}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 rounded-lg border border-[#5d4b24] bg-[#2f2413] p-4">
              <p className="text-sm font-semibold text-[#ffe0a3]">
                Pesanan tanggal ini tidak bisa ditambah, diubah, atau dihapus
                setelah rekap harian tersimpan.
              </p>
              <p className="mt-2 text-sm text-[#cfcfcf]">
                Gunakan tombol ini hanya saat closing harian sudah final.
              </p>
            </div>

            {dailySemiLeftovers.length > 0 && (
              <div className="mt-3 rounded-lg border border-[#4a2e2e] bg-[#2a1b1b] p-4">
                <p className="text-sm font-semibold text-red-300">
                  Sisa bahan olahan dibuang dan dicatat sebagai kerugian:
                </p>
                <ul className="mt-2 space-y-1 text-sm text-[#e5e5e5]">
                  {dailySemiLeftovers.map((item) => (
                    <li key={item.id} className="flex justify-between gap-3">
                      <span>
                        {item.name} · {Number(item.stock).toLocaleString("id-ID")} {item.unit}
                      </span>
                      <span className="font-semibold text-red-300">
                        {formatCurrency(item.stockValue)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-[#ababab]">
                  Stoknya mulai dari 0 lagi. Porsi dari masak setelah tanggal rekap tidak ikut dibuang.
                </p>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-3 border-t border-[#333] pt-4">
              <button
                type="button"
                onClick={closeDailyConfirmModal}
                disabled={saveDailyRecapMutation.isPending}
                className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5] hover:bg-[#3d3d3d] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => saveDailyRecapMutation.mutate(pendingDailyRecapPayload)}
                disabled={saveDailyRecapMutation.isPending}
                className="rounded-lg bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010] hover:bg-[#b7aa94] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saveDailyRecapMutation.isPending
                  ? "Menyimpan..."
                  : "Simpan & Kunci Pesanan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecapManagement;
