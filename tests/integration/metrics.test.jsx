import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import Metrics from "../../src/components/dashboard/Metrics";
import { getJakartaDateKey } from "../../src/shared/lib/dates";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  getCategories: vi.fn(),
  getMenuItems: vi.fn(),
  getOrders: vi.fn(),
  getRecaps: vi.fn(),
  getStockItems: vi.fn(),
}));

const today = getJakartaDateKey();
const makeOrder = (id, totalWithTax, extra = {}) => ({
  id,
  orderDate: `${today} 10:00:00`,
  orderType: "Offline",
  paymentMethod: "Tunai",
  bills: { total: totalWithTax, tax: 0, totalWithTax },
  items: [],
  ...extra,
});

const orders = [
  makeOrder(1, 100000, { paymentMethod: "QRIS" }),
  makeOrder(2, 50000),
  makeOrder(3, 90000, {
    orderType: "Online",
    orderPlatform: "ShopeeFood",
    platformTax: 10000,
    paymentMethod: "QRIS",
  }),
  makeOrder(4, 200000, {
    paymentMethod: "QRIS",
    cateringDetails: { paymentPlan: "Full" },
  }),
];

const cardOf = (title) =>
  screen.getByText(title).closest('[class*="min-h-[124px]"]');

describe("dashboard metrics", () => {
  beforeEach(() => {
    const empty = { data: { data: [] } };
    api.getCategories.mockResolvedValue(empty);
    api.getMenuItems.mockResolvedValue(empty);
    api.getRecaps.mockResolvedValue(empty);
    api.getStockItems.mockResolvedValue(empty);
    api.getOrders.mockResolvedValue({ data: { data: orders } });
  });

  it("shows sales after QRIS 0.7% (above Rp100.000) and platform fee deductions", async () => {
    renderWithProviders(<Metrics />, { route: "/dashboard" });

    // Offline: 100.000 QRIS (fee-free up to Rp100.000) + 50.000 cash.
    await waitFor(() =>
      expect(cardOf("Penjualan Offline")).toHaveTextContent(/Rp\s150\.000$/)
    );
    // Online: 100.000 gross - 10.000 platform fee.
    expect(cardOf("Penjualan Online")).toHaveTextContent(/Rp\s90\.000$/);
    // Catering: 200.000 QRIS - 0,7%.
    expect(cardOf("Penjualan Catering")).toHaveTextContent(/Rp\s198\.600$/);
    expect(cardOf("Total Penjualan")).toHaveTextContent(/Rp\s438\.600$/);
    // Keuntungan follows Rekap New, so it counts days without a daily recap too.
    expect(
      screen.getByText("Penjualan Bersih").closest(".min-w-0")
    ).toHaveTextContent(/Rp\s438\.600$/);
  });
});
