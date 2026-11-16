// Rekap Harian: what the notas of one day bring in, for the system amounts
// of its form and its Riwayat. Konsumsi Crew is no sale (not a transaksi,
// no money). Cash masuk: in-store Tunai; QRIS masuk: in-store QR less the
// QRIS fee (MDR); Saldo online masuk: online notas less the platform's fee.
import {
  getOrderGrossRevenue,
  getOrderHppTotal,
  getOrderNetRevenue,
  getOrderPlatformDeduction,
  getOrderQrisDeduction,
  isCashPayment,
  isCrewOrder,
  isQrPayment,
} from "./orderMetrics";

export const isCateringOrder = (order) =>
  Boolean(order?.cateringDetails) ||
  order?.orderType === "Catering" ||
  Boolean(order?.items?.some((item) => item.categoryName === "Catering"));

// Where the money of a nota lands: cash, qris, online, other (a non-cash
// payment that is no QR) or crew (none).
const channelOf = (order) => {
  if (isCrewOrder(order)) return "crew";
  if (order?.orderType === "Online") return "online";
  if (isCashPayment(order?.paymentMethod)) return "cash";
  if (isQrPayment(order?.paymentMethod)) return "qris";
  return "other";
};

// Which omzet a nota counts in: offline, online, catering, or crew (none).
const kindOf = (order) => {
  if (isCrewOrder(order)) return "crew";
  if (isCateringOrder(order)) return "catering";
  return order?.orderType === "Online" ? "online" : "offline";
};

// One nota of the Riwayat: its omzet kind, where its money lands, its total,
// the fee taken off (MDR or platform), what came in, and its HPP.
export const getRecapOrderLine = (order, menuItems = []) => {
  const gross = getOrderGrossRevenue(order);
  const channel = channelOf(order);
  const fee =
    channel === "online" ? getOrderPlatformDeduction(order) : getOrderQrisDeduction(order, gross);

  return {
    order,
    kind: kindOf(order),
    channel,
    gross,
    fee,
    net: getOrderNetRevenue(order, gross),
    hpp: getOrderHppTotal(order, menuItems),
  };
};

const sumOf = (lines, pick) => lines.reduce((total, line) => total + pick(line), 0);

// The money of one channel: total of its notas, fee (whole rupiah) and what came in.
const channelTotals = (lines, channel) => {
  const own = lines.filter((line) => line.channel === channel);
  const gross = Math.round(sumOf(own, (line) => line.gross));
  const fee = Math.round(sumOf(own, (line) => line.fee));

  return { gross, fee, net: gross - fee };
};

// System amounts of a day from its notas (orders of that day only).
export const getDailyRecapSystem = (orders = [], menuItems = []) => {
  const lines = orders
    .map((order) => getRecapOrderLine(order, menuItems))
    .sort((first, second) => new Date(first.order.orderDate) - new Date(second.order.orderDate));
  const revenueOf = (kind) =>
    Math.round(sumOf(lines.filter((line) => line.kind === kind), (line) => line.gross));

  return {
    lines,
    transactionTotal: lines.filter((line) => line.kind !== "crew").length,
    offlineRevenue: revenueOf("offline"),
    onlineRevenue: revenueOf("online"),
    cateringRevenue: revenueOf("catering"),
    hppTotal: Math.round(sumOf(lines, (line) => line.hpp)),
    cash: channelTotals(lines, "cash"),
    qris: channelTotals(lines, "qris"),
    online: channelTotals(lines, "online"),
  };
};
