import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import { OrdersPage } from "../../src/features/orders";
import { getJakartaDateKey } from "../../src/shared/lib/dates";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  addCateringPayment: vi.fn(),
  deleteOrder: vi.fn(),
  getOrders: vi.fn(),
}));

const today = getJakartaDateKey();
const makeOrder = (id, name, orderDate, totalWithTax, extra = {}) => ({
  id,
  _id: id,
  orderId: `2601-000${id}`,
  customerDetails: { name },
  orderType: "Offline",
  orderStatus: "In Progress",
  orderDate,
  bills: { total: totalWithTax, tax: 0, totalWithTax },
  items: [],
  paymentMethod: "Cash",
  ...extra,
});

const orders = [
  makeOrder(1, "Pelanggan Lama", "2026-01-05 09:00:00", 40000),
  makeOrder(2, "Pagi Ini", `${today} 08:00:00`, 25000),
  makeOrder(3, "Siang Ini", `${today} 12:30:00`, 30000),
  makeOrder(4, "Catering DP", `${today} 10:00:00`, 500000, {
    cateringDetails: { paymentPlan: "DP", isPaid: false, dp: 200000 },
  }),
];

// Each order card shows "Order ID: <code>"; codes end with the order id.
const cardIds = () =>
  screen.queryAllByText(/^Order ID:/).map((node) => Number(node.textContent.slice(-1)));

describe("orders page", () => {
  beforeEach(() => {
    api.getOrders.mockResolvedValue({ data: { data: orders } });
  });

  it("shows today's orders newest first with received revenue", async () => {
    renderWithProviders(<OrdersPage />, { route: "/orders" });

    await waitFor(() => expect(cardIds()).toEqual([3, 4, 2]));
    const revenueCard = screen.getByText(/^Total Penjualan/).closest("div").parentElement;
    // DP catering counts only the down payment: 30.000 + 200.000 + 25.000.
    expect(revenueCard).toHaveTextContent(/Rp\s255\.000$/);
    const countCard = screen.getByText(/^Total Orderan/).closest("div").parentElement;
    expect(countCard).toHaveTextContent(/3$/);
  });

  it("shows every order grouped by day after reset", async () => {
    renderWithProviders(<OrdersPage />, { route: "/orders" });
    await waitFor(() => expect(cardIds()).toHaveLength(3));

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(cardIds()).toEqual([3, 4, 2, 1]);
    expect(screen.getByText("Total Penjualan Semua Tanggal")).toBeInTheDocument();
    expect(screen.getByText("January 05, 2026")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();
  });

  it("hides the delete action while order deletion is turned off", async () => {
    renderWithProviders(<OrdersPage />, { route: "/orders" });
    await waitFor(() => expect(cardIds()).toHaveLength(3));

    fireEvent.click(screen.getAllByRole("button", { name: "Order actions" })[0]);

    expect(screen.getByRole("button", { name: "Lihat Detail" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hapus Pesanan" })).not.toBeInTheDocument();
    expect(api.deleteOrder).not.toHaveBeenCalled();
  });

  it("shows the empty state when nothing matches", async () => {
    api.getOrders.mockResolvedValue({ data: { data: [orders[0]] } });
    renderWithProviders(<OrdersPage />, { route: "/orders" });

    expect(await screen.findByText("No orders available")).toBeInTheDocument();
  });
});
