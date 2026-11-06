import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import RecapManagement from "../../src/components/dashboard/RecapManagement";
import { getJakartaDateKey } from "../../src/shared/lib/dates";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  getMenuItems: vi.fn(),
  getOrders: vi.fn(),
  getRecaps: vi.fn(),
  getUsers: vi.fn(),
}));

const asAdmin = { user: { _id: 1, name: "Admin", email: "a", phone: "1", role: "Admin", isAuth: true } };
const today = getJakartaDateKey();

describe("rekap new promos", () => {
  beforeEach(() => {
    api.getRecaps.mockResolvedValue({ data: { data: [] } });
    api.getUsers.mockResolvedValue({ data: { data: [] } });
    api.getMenuItems.mockResolvedValue({
      data: {
        data: [
          { id: 7, name: "Kopi Susu", isBundle: false },
          { id: 50, name: "Paket Hemat", isBundle: true },
        ],
      },
    });
    api.getOrders.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            orderDate: `${today} 10:00:00`,
            orderType: "Offline",
            paymentMethod: "Tunai",
            bills: { total: 43000, tax: 0, totalWithTax: 43000 },
            items: [
              // A free coffee for a review: 100% of 15.000.
              { id: "a", menuItemId: 40, name: "Menu review B5", quantity: 1, pricePerQuantity: 0, price: 0, discountPercent: 100, discountAmount: 15000 },
              // A promo at its own price, and an ordinary menu.
              { id: "b", menuItemId: 50, name: "Paket Hemat", quantity: 1, pricePerQuantity: 25000, price: 25000, discountPercent: 0, discountAmount: 0 },
              { id: "c", menuItemId: 7, name: "Kopi Susu", quantity: 1, pricePerQuantity: 18000, price: 18000, discountPercent: 0, discountAmount: 0 },
            ],
          },
        ],
      },
    });
  });

  it("adds a Total Promo card and shows promo lines marked, the discount in brackets", async () => {
    renderWithProviders(<RecapManagement />, { preloadedState: asAdmin });
    fireEvent.click(await screen.findByRole("button", { name: "New" }));

    const card = (await screen.findByText("Total Promo")).parentElement;
    expect(card).toHaveTextContent(/^Total Promo\(-Rp\s15\.000\)$/);

    const rowOf = async (name) => (await screen.findByText(name)).closest("tr");
    const review = await rowOf("Menu review B5");
    expect(within(review).getByText("Promo")).toBeInTheDocument();
    expect(within(review).getByText(/^Rp\s15\.000$/)).toBeInTheDocument();
    expect(within(review).getByText(/^\(-Rp\s15\.000\)$/)).toBeInTheDocument();

    expect(within(await rowOf("Paket Hemat")).getByText("Promo")).toBeInTheDocument();
    expect(within(await rowOf("Kopi Susu")).queryByText("Promo")).not.toBeInTheDocument();
  });
});
