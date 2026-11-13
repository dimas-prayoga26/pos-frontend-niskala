// Order figures used by home, orders, dashboard and recaps: display code,
// money actually received, and HPP (cost of goods) per item/order.
import { APP_TIME_ZONE, getJakartaDateKey, getJakartaParts } from "../../../shared/lib/dates";

// Konsumsi Crew: a crew member's free meal on break (order type "Crew"),
// from 12:00 Jakarta time. Its HPP is a crew cost, apart from the sales'.
export const CREW_ORDER_TYPE = "Crew";
export const CREW_MEAL_START_HOUR = 12;
export const isCrewOrder = (order) => order?.orderType === CREW_ORDER_TYPE;
export const isCrewMealTime = (now = new Date()) =>
  Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: APP_TIME_ZONE,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now)
  ) >= CREW_MEAL_START_HOUR;

export const QRIS_FEE_RATE = 0.007;
// From October 2026 QRIS payments up to Rp100.000 carry no fee (MDR 0%) and
// only larger ones pay 0.7%; orders before that keep the flat 0.7%.
export const QRIS_FREE_LIMIT = 100000;
export const QRIS_FREE_LIMIT_SINCE = "2026-10-01";

const toPositiveNumber = (value) => Math.max(Number(value) || 0, 0);

export const getDisplayOrderCode = (order) => {
  const orderCode = order?.orderId || order?.orderCode;

  if (orderCode) return orderCode;

  const parts = getJakartaParts(order?.orderDate);
  const sequence = String(order?.id || order?._id || 0).padStart(4, "0");

  if (!parts) return sequence;

  return `${parts.year.slice(-2)}${parts.month}-${sequence}`;
};

// Items bought in an order: the quantities of its lines (a promo package
// counts as one per portion), e.g. 2 for "Matcha Latte x2".
export const getOrderItemCount = (order) =>
  (order?.items || []).reduce((sum, item) => sum + Math.max(Number(item?.quantity) || 0, 0), 0);

// Items sold by the orders.
export const getOrdersItemCount = (orders = []) =>
  orders.reduce((total, order) => total + getOrderItemCount(order), 0);

export const getOrderReceivedAmount = (order) => {
  const totalWithTax = Number(order?.bills?.totalWithTax) || 0;

  if (!order?.cateringDetails) return totalWithTax;

  const paymentPlan = order.cateringDetails.paymentPlan || "Full";
  const isPaid = Boolean(order.cateringDetails.isPaid);

  if (paymentPlan !== "DP" || isPaid) return totalWithTax;

  return Number(order.cateringDetails.dp ?? order.bills?.dp ?? 0) || 0;
};

const normalizeComparableText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export const isCashPayment = (paymentMethod) => {
  const normalized = normalizeComparableText(paymentMethod);

  return normalized === "tunai" || normalized === "cash";
};

export const isQrPayment = (paymentMethod) => {
  const normalized = normalizeComparableText(paymentMethod);

  return normalized.includes("qr") || normalized.includes("qris");
};

export const isOrderPlatformMatch = (order, platformName) =>
  normalizeComparableText(order?.orderPlatform).includes(
    normalizeComparableText(platformName)
  );

export const getOrderPlatformDeduction = (order) =>
  order?.orderType === "Online" ? toPositiveNumber(order.platformTax) : 0;

export const getOrderGrossRevenue = (order) =>
  getOrderReceivedAmount(order) + getOrderPlatformDeduction(order);

const isQrisFeeFree = (order, amount) =>
  amount <= QRIS_FREE_LIMIT &&
  getJakartaDateKey(order?.orderDate || new Date()) >= QRIS_FREE_LIMIT_SINCE;

// Online orders are settled by the platform, so only in-store QR payments pay
// the QRIS fee, and not when the payment is within the fee-free limit.
export const getOrderQrisDeduction = (
  order,
  grossRevenue = getOrderGrossRevenue(order)
) =>
  order?.orderType !== "Online" &&
  isQrPayment(order?.paymentMethod) &&
  !isQrisFeeFree(order, grossRevenue)
    ? Math.max(grossRevenue * QRIS_FEE_RATE, 0)
    : 0;

export const getOrderIncomeDeduction = (
  order,
  grossRevenue = getOrderGrossRevenue(order)
) => getOrderPlatformDeduction(order) + getOrderQrisDeduction(order, grossRevenue);

export const getOrderNetRevenue = (
  order,
  grossRevenue = getOrderGrossRevenue(order)
) => Math.max(grossRevenue - getOrderIncomeDeduction(order, grossRevenue), 0);

export const getOrdersGrossRevenueTotal = (orders = []) =>
  orders.reduce((total, order) => total + getOrderGrossRevenue(order), 0);

export const getOrdersNetRevenueTotal = (orders = []) =>
  orders.reduce((total, order) => total + getOrderNetRevenue(order), 0);

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const parseMenuItemIdFromKey = (value) => {
  const parts = String(value || "").split("-");
  const parsedId = Number(parts[1]);

  return Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null;
};

const getOrderItemMenuId = (item) => {
  const directId = Number(
    item?.sourceMenuItemId || item?.menuItemSourceId || item?.menuId
  );

  if (Number.isFinite(directId) && directId > 0) return directId;

  const menuItemId = Number(item?.menuItemId);
  if (Number.isFinite(menuItemId) && menuItemId > 0) return menuItemId;

  return parseMenuItemIdFromKey(item?.menuItemId) || parseMenuItemIdFromKey(item?.id);
};

const findMenuForOrderItem = (item, menuItems = []) => {
  const menuItemId = getOrderItemMenuId(item);

  if (menuItemId) {
    const menuById = menuItems.find(
      (menuItem) => Number(menuItem.id || menuItem._id) === menuItemId
    );

    if (menuById) return menuById;
  }

  const itemName = normalizeText(item?.name);
  return menuItems.find((menuItem) => normalizeText(menuItem.name) === itemName);
};

export const getOrderItemHpp = (item, menuItems = []) => {
  const snapshotHpp = Number(item?.hppCost ?? item?.hpp ?? item?.hpp_cost);
  if (Number.isFinite(snapshotHpp) && snapshotHpp > 0) return snapshotHpp;

  const menuItem = findMenuForOrderItem(item, menuItems);

  return Number(menuItem?.hppCost ?? menuItem?.hpp ?? 0) || 0;
};

// HPP of one portion in two parts: olahan, from its bahan olahan lines
// (hppOlahan, priced by the day's cooking), and standar, the rest (bahan
// baku, or the menu's HPP when the sale kept no lines).
export const getOrderItemHppSplit = (item, menuItems = []) => {
  const total = getOrderItemHpp(item, menuItems);
  const olahan = Math.min(Math.max(Number(item?.hppOlahan) || 0, 0), total);
  return { standar: total - olahan, olahan };
};

// HPP Standar and HPP Olahan of every item sold; they add up to getOrdersHppTotal.
export const getOrdersHppSplit = (orders = [], menuItems = []) =>
  orders.reduce(
    (split, order) => {
      (order?.items || []).forEach((item) => {
        const quantity = Math.max(Number(item.quantity) || 0, 0);
        const { standar, olahan } = getOrderItemHppSplit(item, menuItems);
        split.standar += standar * quantity;
        split.olahan += olahan * quantity;
      });
      return split;
    },
    { standar: 0, olahan: 0 }
  );

export const getOrderHppTotal = (order, menuItems = []) =>
  (order?.items || []).reduce((total, item) => {
    const quantity = Math.max(Number(item.quantity) || 0, 0);

    return total + getOrderItemHpp(item, menuItems) * quantity;
  }, 0);

export const getOrdersHppTotal = (orders = [], menuItems = []) =>
  orders.reduce((total, order) => total + getOrderHppTotal(order, menuItems), 0);
