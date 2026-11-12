import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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

const item = (name, quantity) => ({ name, quantity, price: 1000, pricePerQuantity: 1000 });
const orders = [
  makeOrder(1, "Pelanggan Lama", "2026-01-05 09:00:00", 40000, { items: [item("Kopi", 9)] }),
  makeOrder(2, "Pagi Ini", `${today} 08:00:00`, 25000, { items: [item("Kopi", 2), item("Roti", 1)] }),
  // A bahan olahan waits for the Daily Prep (Modul 2).
  makeOrder(3, "Siang Ini", `${today} 12:30:00`, 30000, { hppStatus: "pending", items: [item("Nasi", 3)] }),
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
    // Orders / items sold: 2 + 1 + 3 (today only).
    const countCard = screen.getByText(/^Total Orderan/).closest("div").parentElement;
    expect(countCard).toHaveTextContent(/3 \/ \(6 item\)$/);
    // Each card counts the items bought, not its lines: Nasi x3 is 3 items.
    expect(screen.getAllByText(/^\d+ Items$/).map((node) => node.textContent)).toEqual(["3 Items", "0 Items", "3 Items"]);
    // Only the nota whose HPP is still pending is flagged.
    expect(screen.getAllByText("HPP Pending")).toHaveLength(1);
    expect(screen.getByText("Siang Ini").parentElement).toHaveTextContent("HPP Pending");
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

  it("asks for the paper size on Print and prints the order for it", async () => {
    window.localStorage.clear();
    const printed = {
      closed: false,
      document: { open: vi.fn(), write: vi.fn(), close: vi.fn(), images: [] },
      focus: vi.fn(),
      print: vi.fn(),
      close: vi.fn(),
    };
    const open = vi.spyOn(window, "open").mockReturnValue(printed);

    try {
      renderWithProviders(<OrdersPage />, { route: "/orders" });
      await waitFor(() => expect(cardIds()).toHaveLength(3));
      fireEvent.click(screen.getAllByRole("button", { name: "Order actions" })[0]);
      fireEvent.click(screen.getByRole("button", { name: "Lihat Detail" }));

      const details = screen.getByRole("heading", { name: "Order Details" }).closest("div.max-w-lg");

      // Batal prints nothing.
      fireEvent.click(within(details).getByRole("button", { name: "Print" }));
      fireEvent.click(within(screen.getByRole("dialog", { name: "Ukuran Kertas Struk" })).getByRole("button", { name: "Batal" }));
      expect(screen.queryByRole("dialog", { name: "Ukuran Kertas Struk" })).not.toBeInTheDocument();
      expect(open).not.toHaveBeenCalled();

      fireEvent.click(within(details).getByRole("button", { name: "Print" }));
      const paperDialog = screen.getByRole("dialog", { name: "Ukuran Kertas Struk" });
      fireEvent.click(within(paperDialog).getByRole("button", { name: "80 mm" }));

      await waitFor(() => expect(printed.document.write).toHaveBeenCalled());
      expect(screen.queryByRole("dialog", { name: "Ukuran Kertas Struk" })).not.toBeInTheDocument();
      const html = printed.document.write.mock.calls[0][0];
      expect(html).toContain("@page { size: 80mm auto; margin: 0; }");
      expect(html).toContain("/receipt-header-80.png");
      expect(html).toContain("-".repeat(48));

      // The next Print highlights the size used last.
      await waitFor(() => expect(within(details).getByRole("button", { name: "Print" })).toBeEnabled(), { timeout: 4000 });
      fireEvent.click(within(details).getByRole("button", { name: "Print" }));
      expect(within(screen.getByRole("dialog", { name: "Ukuran Kertas Struk" })).getByRole("button", { name: "80 mm" }))
        .toHaveFocus();
    } finally {
      open.mockRestore();
      window.localStorage.clear();
    }
  });

  it("shows the empty state when nothing matches", async () => {
    api.getOrders.mockResolvedValue({ data: { data: [orders[0]] } });
    renderWithProviders(<OrdersPage />, { route: "/orders" });

    expect(await screen.findByText("No orders available")).toBeInTheDocument();
  });
});
