import { describe, expect, it } from "vitest";
import {
  filterOrdersByDateRange,
  getDateRangeLabel,
  getSummaryDateRangeLabel,
  groupOrdersByDay,
  sumReceivedAmount,
} from "./orderFilters";

const orders = [
  { id: 1, orderDate: "2026-01-05 09:00:00", bills: { totalWithTax: 10000 } },
  { id: 2, orderDate: "2026-01-07 08:00:00", bills: { totalWithTax: 20000 } },
  { id: 3, orderDate: "2026-01-07 12:00:00", bills: { totalWithTax: 30000 } },
  { id: 4, orderDate: "bad date", bills: { totalWithTax: 99 } },
];

describe("order filters", () => {
  it("keeps orders inside the Jakarta date range, newest first", () => {
    const ids = (list) => list.map((order) => order.id);
    expect(ids(filterOrdersByDateRange(orders, { startDate: "2026-01-06", endDate: "2026-01-07" }))).toEqual([3, 2]);
    expect(ids(filterOrdersByDateRange(orders, { startDate: "", endDate: "2026-01-05" }))).toEqual([1]);
    expect(ids(filterOrdersByDateRange(orders, { startDate: "", endDate: "" }))).toEqual([3, 2, 1]);
  });

  it("groups consecutive orders by day and sums received money", () => {
    const sorted = filterOrdersByDateRange(orders, { startDate: "", endDate: "" });
    expect(groupOrdersByDay(sorted).map((group) => [group.dateKey, group.label, group.orders.length])).toEqual([
      ["2026-01-07", "January 07, 2026", 2],
      ["2026-01-05", "January 05, 2026", 1],
    ]);
    expect(sumReceivedAmount(sorted)).toBe(60000);
  });

  it("labels ranges for the filter input and summary cards", () => {
    expect(getDateRangeLabel({ startDate: "", endDate: "" })).toBe("Semua tanggal");
    expect(getDateRangeLabel({ startDate: "2026-01-05", endDate: "2026-01-05" })).toBe("January 05, 2026");
    expect(getDateRangeLabel({ startDate: "2026-01-05", endDate: "2026-01-07" })).toBe(
      "January 05, 2026 - January 07, 2026"
    );
    expect(getDateRangeLabel({ startDate: "2026-01-05", endDate: "" })).toBe("Mulai January 05, 2026");
    expect(getSummaryDateRangeLabel({ startDate: "", endDate: "" })).toBe("Semua Tanggal");
    expect(getSummaryDateRangeLabel({ startDate: "", endDate: "2026-01-07" })).toBe("Sampai 07/01/2026");
  });
});
