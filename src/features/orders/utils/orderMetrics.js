// Order figures used by home, orders, dashboard and recaps: display code,
// money actually received, and HPP (cost of goods) per item/order.
import { getJakartaParts } from "../../../shared/lib/dates";

export const QRIS_FEE_RATE = 0.007;

const toPositiveNumber = (value) => Math.max(Number(value) || 0, 0);

export const getDisplayOrderCode = (order) => {
  const orderCode = order?.orderId || order?.orderCode;

  if (orderCode) return orderCode;

  const parts = getJakartaParts(order?.orderDate);
  const sequence = String(order?.id || order?._id || 0).padStart(4, "0");

  if (!parts) return sequence;

  return `${parts.year.slice(-2)}${parts.month}-${sequence}`;
};

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

export const getOrderQrisDeduction = (
  order,
  grossRevenue = getOrderGrossRevenue(order)
) =>
  isQrPayment(order?.paymentMethod)
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

const parseSizeNameFromKey = (value) => {
  const parts = String(value || "").split("-");

  return parts.length > 2 ? parts.slice(2).join("-").trim() : "";
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

const getOrderItemSizeName = (item) => {
  const explicitSize = String(item?.sizeVariant || item?.sizeName || "").trim();
  if (explicitSize) return explicitSize;

  const sizeFromKey =
    parseSizeNameFromKey(item?.menuItemId) || parseSizeNameFromKey(item?.id);
  if (sizeFromKey) return sizeFromKey;

  return String(item?.variant || "").split("/")[0].trim();
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
  if (!menuItem) return 0;

  const sizes = Array.isArray(menuItem.sizes) ? menuItem.sizes : [];
  if (sizes.length) {
    const sizeName = normalizeText(getOrderItemSizeName(item));
    const matchedSize =
      sizes.find((size) => normalizeText(size.name) === sizeName) || sizes[0];

    return Number(matchedSize?.hppCost ?? matchedSize?.hpp ?? 0) || 0;
  }

  return Number(menuItem.hppCost ?? menuItem.hpp ?? 0) || 0;
};

export const getOrderHppTotal = (order, menuItems = []) =>
  (order?.items || []).reduce((total, item) => {
    const quantity = Math.max(Number(item.quantity) || 0, 0);

    return total + getOrderItemHpp(item, menuItems) * quantity;
  }, 0);

export const getOrdersHppTotal = (orders = [], menuItems = []) =>
  orders.reduce((total, order) => total + getOrderHppTotal(order, menuItems), 0);
