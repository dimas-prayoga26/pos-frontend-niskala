import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import RecapManagement from "../../src/components/dashboard/RecapManagement";
import { getJakartaDateKey } from "../../src/shared/lib/dates";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  addRecap: vi.fn(),
  getMenuItems: vi.fn(),
  getOrders: vi.fn(),
  getOrderItemCosts: vi.fn(),
  getRecaps: vi.fn(),
  getSemiItems: vi.fn(),
  getStockWastes: vi.fn(),
  getUsers: vi.fn(),
}));

const empty = { data: { data: [] } };
// A nota of today: 2 Latte (with a recipe) and 1 Air Mineral (none).
const order = {
  _id: 31,
  orderId: "ORD-31",
  orderDate: new Date().toISOString(),
  orderType: "Offline",
  orderStatus: "Completed",
  paymentMethod: "QRIS",
  bills: { total: 41000, tax: 0, totalWithTax: 41000 },
  items: [
    { id: "1-7", _id: 501, name: "Latte", quantity: 2, pricePerQuantity: 18000, price: 36000, hppCost: 6250 },
    { id: "1-9", _id: 502, name: "Air Mineral", quantity: 1, pricePerQuantity: 5000, price: 5000, hppCost: 0 },
  ],
};
const latteCosts = {
  id: 501,
  orderId: 31,
  name: "Latte",
  quantity: 2,
  hppCost: 6250,
  totalCost: 12500,
  hppStatus: "pending",
  lines: [
    { id: 1, name: "Susu", hppType: "standar", isPending: false, quantity: 150, unit: "ml", unitCost: 25, cost: 3750, totalQuantity: 300, totalCost: 7500 },
    { id: 2, name: "Espresso", hppType: "standar", isPending: false, quantity: 18, unit: "gr", unitCost: 125, cost: 2250, totalQuantity: 36, totalCost: 4500 },
    { id: 3, name: "Gula Aren Cair", hppType: "olahan", isPending: true, quantity: 1, unit: "porsi", unitCost: 250, cost: 250, totalQuantity: 2, totalCost: 500 },
  ],
};

const openNewRecap = async () => {
  renderWithProviders(<RecapManagement />, { preloadedState: { user: { role: "Admin", name: "Admin Uji" } } });
  fireEvent.click(screen.getByRole("button", { name: "New" }));
  return screen.findByRole("button", { name: "Latte" });
};

describe("Rekap New: rincian HPP of a menu sold", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getOrders.mockResolvedValue({ data: { data: [order] } });
    [api.getRecaps, api.getSemiItems, api.getUsers, api.getMenuItems].forEach((fn) => fn.mockResolvedValue(empty));
    api.getStockWastes.mockResolvedValue({ data: { data: { wastes: [], dailyTotals: [] } } });
  });

  it("opens the bahan of a sold menu with their COGS and the total cost", async () => {
    api.getOrderItemCosts.mockResolvedValue({ data: { success: true, data: latteCosts } });
    fireEvent.click(await openNewRecap());

    const dialog = await screen.findByRole("dialog", { name: "Latte" });
    expect(api.getOrderItemCosts).toHaveBeenCalledWith(501);
    expect(await within(dialog).findByText("2 terjual · HPP per porsi Rp 6.250")).toBeInTheDocument();
    const rows = within(dialog).getAllByRole("row");
    expect(rows.map((row) => Array.from(row.cells, (cell) => cell.textContent))).toEqual([
      ["Bahan", "Per Porsi", "COGS", "Total Pakai", "Total Cost"],
      ["Susu", "150 ml", "Rp 25 / ml", "300 ml", "Rp 7.500"],
      ["Espresso", "18 gr", "Rp 125 / gr", "36 gr", "Rp 4.500"],
      ["Gula Aren CairOlahan · sementara", "1 porsi", "Rp 250 / porsi", "2 porsi", "Rp 500"],
      ["Total Cost", "Rp 12.500"],
    ]);

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Latte" })).not.toBeInTheDocument());
  });

  it("says when a menu has no bahan, and when loading fails", async () => {
    api.getOrderItemCosts.mockResolvedValueOnce({
      data: { success: true, data: { id: 502, name: "Air Mineral", quantity: 1, hppCost: 0, totalCost: 0, lines: [] } },
    });
    await openNewRecap();
    fireEvent.click(screen.getByRole("button", { name: "Air Mineral" }));
    const dialog = await screen.findByRole("dialog", { name: "Air Mineral" });
    expect(await within(dialog).findByText("Tidak ada bahan tercatat saat menu ini terjual.")).toBeInTheDocument();
    expect(within(dialog).getByTestId("item-total-cost")).toHaveTextContent("Rp 0");
    fireEvent.click(within(dialog).getByRole("button", { name: "Tutup" }));

    api.getOrderItemCosts.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByRole("button", { name: "Latte" }));
    expect(await screen.findByText("Gagal memuat rincian HPP.")).toBeInTheDocument();
  });
});

const asAdmin = { user: { _id: 1, name: "Admin", email: "a", phone: "1", role: "Admin", isAuth: true } };
const today = getJakartaDateKey();

describe("rekap new promos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getSemiItems.mockResolvedValue({ data: { data: [] } });
    api.getStockWastes.mockResolvedValue({ data: { data: { wastes: [], dailyTotals: [] } } });
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

describe("Rekap Old", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getOrders.mockResolvedValue({ data: { data: [order] } });
    [api.getRecaps, api.getSemiItems, api.getUsers, api.getMenuItems].forEach((fn) => fn.mockResolvedValue(empty));
    api.getStockWastes.mockResolvedValue({ data: { data: { wastes: [], dailyTotals: [] } } });
  });

  it("is daily only, and its form takes Cash, QRIS and Saldo online masuk but no Transfer masuk", async () => {
    renderWithProviders(<RecapManagement />, { preloadedState: { user: { role: "Admin", name: "Admin Uji" } } });

    expect(await screen.findByText("Rekap transaksi harian.")).toBeInTheDocument();
    ["Harian", "Mingguan", "Bulanan"].forEach((name) =>
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument()
    );

    fireEvent.click(await screen.findByRole("button", { name: "Tambah Rekap" }));
    expect(await screen.findByText("Input Rekap Harian")).toBeInTheDocument();
    expect(screen.getByText("Cash masuk (Rp)")).toBeInTheDocument();
    expect(screen.getByText("QRIS masuk (Rp)")).toBeInTheDocument();
    expect(screen.queryByText("Transfer masuk (Rp)")).not.toBeInTheDocument();
    // What GoFood, Grab, ... paid out, typed like the other amounts.
    const online = screen.getByText("Saldo online masuk (Rp)").closest("label").querySelector("input");
    fireEvent.change(online, { target: { value: "76000" } });
    expect(online).toHaveValue("76.000");
    // The menu pickers still follow the money inputs.
    expect(screen.getByText("Menu paling laku")).toBeInTheDocument();
    expect(screen.getByText("Menu kurang laku")).toBeInTheDocument();
  });
});
