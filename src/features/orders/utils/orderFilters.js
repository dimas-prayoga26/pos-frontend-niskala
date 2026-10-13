import {
  formatJakartaDate,
  formatJakartaReceiptDate,
  getJakartaDateKey,
} from "../../../shared/lib/dates";
import { getOrderReceivedAmount } from "./orderMetrics";

// Date ranges use Jakarta date keys ("YYYY-MM-DD"); an empty bound is open.
export const filterOrdersByDateRange = (orders, { startDate, endDate }) =>
  orders
    .filter((order) => {
      const orderDateKey = getJakartaDateKey(order.orderDate);

      if (!orderDateKey) return false;
      if (startDate && orderDateKey < startDate) return false;
      if (endDate && orderDateKey > endDate) return false;

      return true;
    })
    .sort(
      (firstOrder, secondOrder) =>
        new Date(secondOrder.orderDate) - new Date(firstOrder.orderDate)
    );

// Groups consecutive orders (already sorted) by their Jakarta day.
export const groupOrdersByDay = (orders) =>
  orders.reduce((groups, order) => {
    const dateKey = getJakartaDateKey(order.orderDate);
    const lastGroup = groups[groups.length - 1];

    if (lastGroup?.dateKey === dateKey) {
      lastGroup.orders.push(order);
    } else {
      groups.push({
        dateKey,
        label: formatJakartaDate(order.orderDate),
        orders: [order],
      });
    }

    return groups;
  }, []);

export const sumReceivedAmount = (orders) =>
  orders.reduce((total, order) => total + getOrderReceivedAmount(order), 0);

const formatRange = ({ startDate, endDate }, formatDate, allDatesLabel) => {
  if (!startDate && !endDate) return allDatesLabel;
  if (startDate && startDate === endDate) return formatDate(startDate);
  if (startDate && endDate) return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  if (startDate) return `Mulai ${formatDate(startDate)}`;

  return `Sampai ${formatDate(endDate)}`;
};

// Label in the filter input, e.g. "January 05, 2026 - January 07, 2026".
export const getDateRangeLabel = (range) =>
  formatRange(range, formatJakartaDate, "Semua tanggal");

// Label in the summary cards, e.g. "05/01/2026 - 07/01/2026".
export const getSummaryDateRangeLabel = (range) =>
  formatRange(range, formatJakartaReceiptDate, "Semua Tanggal");
