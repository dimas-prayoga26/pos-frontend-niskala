import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import MenuPerformance from "../../src/features/dashboard/components/MenuPerformance";
import { getJakartaDateKey } from "../../src/shared/lib/dates";
import { rangeLabel } from "../../src/features/inventory/utils/periods";
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

const card = (group) => screen.getByRole("region", { name: `${group} Paling Laku` });
// Each body row of the Rincian Menu table, as its cells' text.
const tableRows = () =>
  within(screen.getByRole("table", { name: "Rincian Menu" }))
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole("cell")
        // The menu cell: its name, then its menu categories.
        .map((cell) => (cell.children.length > 1 ? [...cell.children].map((part) => part.textContent).join(" · ") : cell.textContent))
        .map((text) => text.replace(/\s/g, " "))
    );

describe("Menu Paling Laku tab", () => {
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
    expect(screen.getByText("10 Menu Paling Laku")).toBeInTheDocument();
    expect(screen.getByText("Komposisi Omzet per Kategori")).toBeInTheDocument();
    unmount();

    renderWithProviders(<MenuPerformance showCharts={false} />);
    expect(await within(card("Makanan")).findByText("Nasi Goreng")).toBeInTheDocument();
    expect(screen.queryByText("10 Menu Paling Laku")).not.toBeInTheDocument();
    expect(screen.queryByText("Komposisi Omzet per Kategori")).not.toBeInTheDocument();
  });

  it("charts the Top 10 menus by qty sold, menus sold equally sharing a rank", async () => {
    renderWithProviders(<MenuPerformance />);

    const list = await screen.findByRole("list", { name: "10 Menu Paling Laku" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual([
      "1. Es Teh (Tea), Minuman: 5 terjual, Rp 40.000",
      "2. Nasi Goreng (Main Course), Makanan: 3 terjual, Rp 75.000",
      "3. Mie Goreng (Main Course), Makanan: 2 terjual, Rp 44.000",
      "3. Paket Hemat (PROMO), Bundling: 2 terjual, Rp 60.000",
    ]);
    // Each row names its kind, not only its bar color, and its menu category.
    expect(within(rows[3]).getByText("Bundling · PROMO")).toBeInTheDocument();
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

  it("adds Add Ons and menus since deleted to the donut as Lainnya, so its total is the whole omzet", async () => {
    api.getMenuItems.mockResolvedValue({
      data: { data: [...menuItems, { id: 6, name: "Air Mineral", category: category("Add Ons", null) }] },
    });
    api.getOrders.mockResolvedValue({
      data: {
        data: [
          ...orders,
          {
            id: 5,
            orderDate: `${today} 13:00:00`,
            orderType: "Offline",
            // An add-on, a menu deleted since (no menuItemId, no menu by its name)
            // and a loyalty reward (no sale).
            items: [
              line(6, "Air Mineral", 4, 5000),
              line(null, "Hazelnut Latte", 2, 20000),
              { ...line(3, "Es Teh", 1, 8000), id: "loyalty-5" },
            ],
          },
        ],
      },
    });
    renderWithProviders(<MenuPerformance />);

    // 219.000 of the kinds + Lainnya 60.000 (20.000 + 40.000) = 279.000.
    expect(
      await screen.findByRole("img", {
        name: "Komposisi omzet: Makanan 42,7%, Minuman 14,3%, Snack 0%, Bundling 21,5%, Lainnya 21,5%",
      })
    ).toBeInTheDocument();
    const donut = screen.getByRole("region", { name: "Komposisi Omzet per Kategori" });
    expect(within(donut).getByText(/^Rp\s279\.000$/)).toBeInTheDocument();
    // Neither shows up as a menu of the table.
    expect(screen.queryByRole("cell", { name: /Air Mineral|Hazelnut Latte/ })).not.toBeInTheDocument();
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
      ["1", "Nasi Goreng · Main Course", "Makanan", "3", "Rp 75.000", "34,247%", "+50%"],
      ["2", "Paket Hemat · PROMO", "Bundling", "2", "Rp 60.000", "27,397%", "0%"],
      ["3", "Mie Goreng · Main Course", "Makanan", "2", "Rp 44.000", "20,091%", "Baru"],
      ["4", "Es Teh · Tea", "Minuman", "5", "Rp 40.000", "18,265%", "-50%"],
    ]);
    // This month up to today, against the same days of last month.
    expect(
      screen.getByText(`Tren omzet ${rangeLabel({ from: `${today.slice(0, 8)}01`, to: today })} dibanding`, { exact: false })
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Total Omzet" })).toHaveAttribute("aria-sort", "descending");
  });

  it("orders the table by qty and filters it by kind", async () => {
    renderWithProviders(<MenuPerformance />);
    await within(card("Makanan")).findByText("Nasi Goreng");

    fireEvent.click(screen.getByRole("button", { name: "Terjual" }));
    expect(screen.getByRole("columnheader", { name: "Terjual" })).toHaveAttribute("aria-sort", "descending");
    // Menus sold equally share a rank; the omzet orders them.
    expect(tableRows().map((row) => [row[0], row[1]])).toEqual([
      ["1", "Es Teh · Tea"],
      ["2", "Nasi Goreng · Main Course"],
      ["3", "Paket Hemat · PROMO"],
      ["3", "Mie Goreng · Main Course"],
    ]);

    const filter = screen.getByRole("group", { name: "Filter kategori" });
    fireEvent.click(within(filter).getByRole("button", { name: "Makanan" }));
    expect(within(filter).getByRole("button", { name: "Makanan" })).toHaveAttribute("aria-pressed", "true");
    // Ranked within the kind; the share stays of the whole omzet.
    expect(tableRows().map((row) => [row[0], row[1], row[5]])).toEqual([
      ["1", "Nasi Goreng · Main Course", "34,247%"],
      ["2", "Mie Goreng · Main Course", "20,091%"],
    ]);

    fireEvent.click(within(filter).getByRole("button", { name: "Snack" }));
    expect(tableRows()).toEqual([["Belum ada penjualan di periode ini."]]);
  });

  it("turns the whole tab round under Kurang Laku: cards, Top 10 and table, the donut as it is", async () => {
    renderWithProviders(<MenuPerformance />);
    await within(card("Makanan")).findByText("Nasi Goreng");
    const donut = screen.getByRole("img", { name: /^Komposisi omzet:/ }).getAttribute("aria-label");

    const order = screen.getByRole("group", { name: "Urutan" });
    fireEvent.click(within(order).getByRole("button", { name: "Kurang Laku" }));
    expect(within(order).getByRole("button", { name: "Kurang Laku" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Menu Kurang Laku" })).toBeInTheDocument();
    expect(screen.getByText("Menu paling sepi per jenis.")).toBeInTheDocument();

    // The least sold of each kind; Roti Kukus is on sale but sold nothing.
    const leastCard = (group) => screen.getByRole("region", { name: `${group} Kurang Laku` });
    expect(within(leastCard("Makanan")).getByText("Mie Goreng")).toBeInTheDocument();
    expect(within(leastCard("Minuman")).getByText("Es Teh")).toBeInTheDocument();
    expect(within(leastCard("Snack")).getByText("Roti Kukus")).toBeInTheDocument();
    expect(within(leastCard("Snack")).getByText("0 terjual · Rp 0", { normalizer: (text) => text.replace(/\s/g, " ") })).toBeInTheDocument();
    expect(within(leastCard("Bundling")).getByText("Paket Hemat")).toBeInTheDocument();

    // Least sold first (qty, then omzet), sharing a rank when sold equally.
    const list = screen.getByRole("list", { name: "10 Menu Kurang Laku" });
    expect(within(list).getAllByRole("listitem").map((row) => row.getAttribute("aria-label").split(":")[0])).toEqual([
      "1. Roti Kukus (Roti), Snack",
      "2. Mie Goreng (Main Course), Makanan",
      "2. Paket Hemat (PROMO), Bundling",
      "4. Nasi Goreng (Main Course), Makanan",
      "5. Es Teh (Tea), Minuman",
    ]);

    // The omzet share per kind does not depend on the order.
    expect(screen.getByRole("img", { name: /^Komposisi omzet:/ })).toHaveAttribute("aria-label", donut);

    expect(screen.getByRole("columnheader", { name: "Total Omzet" })).toHaveAttribute("aria-sort", "ascending");
    // Roti Kukus is on sale but sold nothing this month.
    expect(tableRows()).toEqual([
      ["1", "Roti Kukus · Roti", "Snack", "0", "Rp 0", "0,000%", "—"],
      ["2", "Es Teh · Tea", "Minuman", "5", "Rp 40.000", "18,265%", "-50%"],
      ["3", "Mie Goreng · Main Course", "Makanan", "2", "Rp 44.000", "20,091%", "Baru"],
      ["4", "Paket Hemat · PROMO", "Bundling", "2", "Rp 60.000", "27,397%", "0%"],
      ["5", "Nasi Goreng · Main Course", "Makanan", "3", "Rp 75.000", "34,247%", "+50%"],
    ]);

    fireEvent.click(within(screen.getByRole("group", { name: "Filter kategori" })).getByRole("button", { name: "Snack" }));
    expect(tableRows().map((row) => row[1])).toEqual(["Roti Kukus · Roti"]);

    fireEvent.click(within(order).getByRole("button", { name: "Paling Laku" }));
    expect(screen.getByRole("heading", { name: "Menu Paling Laku" })).toBeInTheDocument();
    expect(tableRows()).toEqual([["Belum ada penjualan di periode ini."]]);
  });

  it("shows no trend for all time", async () => {
    renderWithProviders(<MenuPerformance />);
    await within(card("Makanan")).findByText("Nasi Goreng");

    fireEvent.change(screen.getByRole("combobox", { name: "Periode" }), { target: { value: "all" } });
    expect(tableRows().map((row) => row[6])).toEqual(["—", "—", "—", "—", "—"]);
    expect(screen.queryByText(/^Tren omzet /)).not.toBeInTheDocument();
  });
});
