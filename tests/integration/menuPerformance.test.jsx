import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import MenuPerformance from "../../src/features/dashboard/components/MenuPerformance";
import { getJakartaDateKey } from "../../src/shared/lib/dates";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  getMenuItems: vi.fn(),
  getOrders: vi.fn(),
}));

const today = getJakartaDateKey();
// The 1st of last month: inside the days Bulan Ini compares with.
const [thisYear, thisMonth] = today.split("-").map(Number);
const lastMonth = new Date(Date.UTC(thisYear, thisMonth - 2, 1)).toISOString().slice(0, 10);
const category = (name, bestSellerGroup, isBundle = false) => ({ name, bestSellerGroup, isBundle });
const menuItems = [
  { id: 1, name: "Nasi Goreng", category: category("Main Course", "Makanan") },
  { id: 2, name: "Mie Goreng", category: category("Main Course", "Makanan") },
  { id: 3, name: "Es Teh", category: category("Tea", "Minuman") },
  { id: 4, name: "Roti Kukus", category: category("Roti", "Snack") },
  { id: 5, name: "Paket Hemat", isBundle: true, category: category("PROMO", null, true) },
];
const line = (menuItemId, name, quantity, pricePerQuantity) => ({ menuItemId, name, quantity, pricePerQuantity });
const orders = [
  {
    id: 1,
    orderDate: `${today} 10:00:00`,
    orderType: "Offline",
    items: [line(1, "Nasi Goreng", 3, 25000), line(2, "Mie Goreng", 2, 22000), line(3, "Es Teh", 5, 8000), line(5, "Paket Hemat", 2, 30000)],
  },
  // A Konsumsi Crew is not a sale.
  { id: 2, orderDate: `${today} 12:30:00`, orderType: "Crew", items: [line(2, "Mie Goreng", 10, 0)] },
  // Outside this month.
  { id: 3, orderDate: "2025-01-15 09:00:00", orderType: "Offline", items: [line(4, "Roti Kukus", 50, 12000)] },
  // Last month, for the trend.
  {
    id: 4,
    orderDate: `${lastMonth} 11:00:00`,
    orderType: "Offline",
    items: [line(1, "Nasi Goreng", 2, 25000), line(3, "Es Teh", 10, 8000), line(5, "Paket Hemat", 2, 30000)],
  },
];

const card = (group) => screen.getByRole("region", { name: `${group} Terlaris` });
// Each body row of the Rincian Menu table, as its cells' text.
const tableRows = () =>
  within(screen.getByRole("table", { name: "Rincian Menu" }))
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent.replace(/\s/g, " ")));

describe("Menu Terlaris tab", () => {
  beforeEach(() => {
    api.getMenuItems.mockResolvedValue({ data: { data: menuItems } });
    api.getOrders.mockResolvedValue({ data: { data: orders } });
  });

  it("shows the Top 1 of Makanan, Minuman, Snack and Bundling sold this month", async () => {
    renderWithProviders(<MenuPerformance />);

    expect(await within(card("Makanan")).findByText("Nasi Goreng")).toBeInTheDocument();
    expect(within(card("Makanan")).getByText(/3 terjual · Rp\s75\.000/)).toBeInTheDocument();
    expect(within(card("Minuman")).getByText("Es Teh")).toBeInTheDocument();
    expect(within(card("Bundling")).getByText("Paket Hemat")).toBeInTheDocument();
    expect(within(card("Bundling")).getByText(/2 terjual · Rp\s60\.000/)).toBeInTheDocument();
    expect(within(card("Snack")).getByText("Belum ada penjualan di periode ini.")).toBeInTheDocument();
  });

  it("shows the charts under the Top 1 cards, and hides them on request", async () => {
    const { unmount } = renderWithProviders(<MenuPerformance />);

    expect(await within(card("Makanan")).findByText("Nasi Goreng")).toBeInTheDocument();
    expect(screen.getByText("Top 10 Menu Terlaris")).toBeInTheDocument();
    expect(screen.getByText("Komposisi Omzet per Kategori")).toBeInTheDocument();
    unmount();

    renderWithProviders(<MenuPerformance showCharts={false} />);
    expect(await within(card("Makanan")).findByText("Nasi Goreng")).toBeInTheDocument();
    expect(screen.queryByText("Top 10 Menu Terlaris")).not.toBeInTheDocument();
    expect(screen.queryByText("Komposisi Omzet per Kategori")).not.toBeInTheDocument();
  });

  it("charts the Top 10 menus by qty sold, menus sold equally sharing a rank", async () => {
    renderWithProviders(<MenuPerformance />);

    const list = await screen.findByRole("list", { name: "Top 10 Menu Terlaris" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual([
      "1. Es Teh, Minuman: 5 terjual, Rp 40.000",
      "2. Nasi Goreng, Makanan: 3 terjual, Rp 75.000",
      "3. Mie Goreng, Makanan: 2 terjual, Rp 44.000",
      "3. Paket Hemat, Bundling: 2 terjual, Rp 60.000",
    ]);
    // Each row names its kind, not only its bar color.
    expect(within(rows[3]).getByText("Bundling")).toBeInTheDocument();
  });

  it("splits the omzet per kind in the donut and its legend", async () => {
    renderWithProviders(<MenuPerformance />);

    // Makanan 119.000 (Nasi + Mie), Minuman 40.000, Bundling 60.000 of 219.000.
    expect(
      await screen.findByRole("img", { name: "Komposisi omzet: Makanan 54,3%, Minuman 18,3%, Snack 0%, Bundling 27,4%" })
    ).toBeInTheDocument();
    const donut = screen.getByRole("region", { name: "Komposisi Omzet per Kategori" });
    expect(within(donut).getByText("Total omzet")).toBeInTheDocument();
    expect(within(donut).getByText(/^Rp\s219\.000$/)).toBeInTheDocument();

    fireEvent.mouseEnter(within(donut).getByText("Bundling").closest("li"));
    // The centre swaps the total for the hovered kind (the legend row repeats it).
    expect(within(donut).queryByText("Total omzet")).not.toBeInTheDocument();
    expect(within(donut).getAllByText(/^Rp\s60\.000$/)).toHaveLength(2);
    expect(within(donut).getAllByText("27,4%")).toHaveLength(2);
  });

  it("follows the period filter", async () => {
    renderWithProviders(<MenuPerformance />);
    await within(card("Makanan")).findByText("Nasi Goreng");

    fireEvent.change(screen.getByRole("combobox", { name: "Periode" }), { target: { value: "all" } });
    expect(within(card("Snack")).getByText("Roti Kukus")).toBeInTheDocument();
    expect(within(card("Snack")).getByText(/50 terjual/)).toBeInTheDocument();
  });

  it("lists every menu sold in the Rincian Menu table, by omzet first", async () => {
    renderWithProviders(<MenuPerformance />);
    await within(card("Makanan")).findByText("Nasi Goreng");

    // Shares of 219.000; trends against last month's 1st (the same days).
    expect(tableRows()).toEqual([
      ["1", "Nasi Goreng", "Makanan", "3", "Rp 75.000", "34,2%", "+50%"],
      ["2", "Paket Hemat", "Bundling", "2", "Rp 60.000", "27,4%", "0%"],
      ["3", "Mie Goreng", "Makanan", "2", "Rp 44.000", "20,1%", "Baru"],
      ["4", "Es Teh", "Minuman", "5", "Rp 40.000", "18,3%", "-50%"],
    ]);
    expect(screen.getByText(/^Tren omzet dibanding /)).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Total Omzet" })).toHaveAttribute("aria-sort", "descending");
  });

  it("orders the table by qty and filters it by kind", async () => {
    renderWithProviders(<MenuPerformance />);
    await within(card("Makanan")).findByText("Nasi Goreng");

    fireEvent.click(screen.getByRole("button", { name: "Terjual" }));
    expect(screen.getByRole("columnheader", { name: "Terjual" })).toHaveAttribute("aria-sort", "descending");
    // Menus sold equally share a rank; the omzet orders them.
    expect(tableRows().map((row) => [row[0], row[1]])).toEqual([
      ["1", "Es Teh"],
      ["2", "Nasi Goreng"],
      ["3", "Paket Hemat"],
      ["3", "Mie Goreng"],
    ]);

    const filter = screen.getByRole("group", { name: "Filter kategori" });
    fireEvent.click(within(filter).getByRole("button", { name: "Makanan" }));
    expect(within(filter).getByRole("button", { name: "Makanan" })).toHaveAttribute("aria-pressed", "true");
    // Ranked within the kind; the share stays of the whole omzet.
    expect(tableRows().map((row) => [row[0], row[1], row[5]])).toEqual([
      ["1", "Nasi Goreng", "34,2%"],
      ["2", "Mie Goreng", "20,1%"],
    ]);

    fireEvent.click(within(filter).getByRole("button", { name: "Snack" }));
    expect(tableRows()).toEqual([["Belum ada penjualan di periode ini."]]);
  });

  it("shows no trend for all time", async () => {
    renderWithProviders(<MenuPerformance />);
    await within(card("Makanan")).findByText("Nasi Goreng");

    fireEvent.change(screen.getByRole("combobox", { name: "Periode" }), { target: { value: "all" } });
    expect(tableRows().map((row) => row[6])).toEqual(["—", "—", "—", "—", "—"]);
    expect(screen.queryByText(/^Tren omzet dibanding /)).not.toBeInTheDocument();
  });
});
