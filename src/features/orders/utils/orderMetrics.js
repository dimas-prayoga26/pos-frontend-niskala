// Order figures used by home, orders, dashboard and recaps: display code,
// money actually received, and HPP (cost of goods) per item/order.
import { getJakartaParts } from "../../../shared/lib/dates";

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
