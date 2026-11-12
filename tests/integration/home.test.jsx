import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import HomePage from "../../src/features/home/pages/HomePage";
import { getJakartaDateKey } from "../../src/shared/lib/dates";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  getMenuItems: vi.fn(),
  getOrders: vi.fn(),
}));

const today = getJakartaDateKey();
const order = (id, orderDate, quantities) => ({
  id,
  _id: id,
  orderId: `2601-000${id}`,
  customerDetails: { name: `Pelanggan ${id}` },
  orderType: "Offline",
  orderStatus: "Completed",
  orderDate,
  bills: { total: 10000, tax: 0, totalWithTax: 10000 },
  items: quantities.map((quantity, index) => ({ name: `Menu ${index}`, quantity, price: 1000 })),
  paymentMethod: "Cash",
});

describe("home", () => {
  beforeEach(() => {
    api.getMenuItems.mockResolvedValue({ data: { data: [] } });
    api.getOrders.mockResolvedValue({
      data: {
        data: [
          order(1, `${today} 09:00:00`, [2, 1]),
          order(2, `${today} 11:00:00`, [2]),
          order(3, "2026-01-05 09:00:00", [7]),
        ],
      },
    });
  });

  it("shows today's orders next to the items they sold", async () => {
    renderWithProviders(<HomePage />, { route: "/" });

    const card = screen.getByText("Order Hari Ini").closest("div").parentElement;
    await waitFor(() => expect(card).toHaveTextContent("2 / (5 item)"));
  });
});
