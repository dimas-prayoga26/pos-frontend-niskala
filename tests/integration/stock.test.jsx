import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import { StockManagement } from "../../src/features/inventory";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  deleteStockItem: vi.fn(),
  getPurchases: vi.fn(),
  getShoppingSuppliers: vi.fn(),
  getStockItems: vi.fn(),
  updateStockCogs: vi.fn(),
}));

const stockItem = (id, overrides = {}) => ({
  id,
  name: `Bahan ${String(id).padStart(2, "0")}`,
  category: "Umum",
  unit: "pcs",
  stock: 10,
  minimumStock: 2,
  averageCost: 1000,
  stockValue: 10000,
  supplier: "",
  isUnlimited: false,
  status: "AMAN",
  ...overrides,
});

const items = [
  stockItem(1, { name: "Susu Segar", unit: "ml", stock: 800, averageCost: 25.61, stockValue: 20488, supplier: "Toko Susu", status: "HAMPIR HABIS" }),
  stockItem(2, { name: "Air Galon", isUnlimited: true, status: "BEBAS STOK" }),
  ...Array.from({ length: 10 }, (_, index) => stockItem(index + 3)),
];

const asAdmin = { user: { _id: 1, name: "Admin", email: "a", phone: "1", role: "Admin", isAuth: true } };
const asCashier = { user: { ...asAdmin.user, role: "Cashier" } };
const rowOf = (name) => screen.getByText(name).closest("tr");
const findRow = async (name) => (await screen.findByText(name)).closest("tr");

describe("stock management", () => {
  beforeEach(() => {
    api.getStockItems.mockResolvedValue({ data: { data: items } });
    api.getPurchases.mockResolvedValue({ data: { data: { purchases: [], itemGroups: [], total: 0 } } });
    api.getShoppingSuppliers.mockResolvedValue({ data: { data: [] } });
  });

  it("lists stock with status, value and cost per unit, paginated and searchable", async () => {
    renderWithProviders(<StockManagement />, { preloadedState: asAdmin });

    const milk = await findRow("Susu Segar");
    expect(milk).toHaveTextContent("Toko Susu");
    expect(milk).toHaveTextContent("Rp 20.488");
    expect(milk).toHaveTextContent("Rp 26 / ml");
    expect(milk).toHaveTextContent("HAMPIR HABIS");
    expect(rowOf("Air Galon")).toHaveTextContent("Bebas Stok");
    expect(screen.getByText(/^Showing/)).toHaveTextContent("Showing 1 - 10 of 12");
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(/^Showing/)).toHaveTextContent("Showing 11 - 12 of 12");

    fireEvent.change(screen.getByPlaceholderText("Search stock"), { target: { value: "toko susu" } });
    expect(screen.getByText(/^Showing/)).toHaveTextContent("Showing 1 - 1 of 1");

    fireEvent.change(screen.getByPlaceholderText("Search stock"), { target: { value: "zzz" } });
    expect(screen.getByText("No stock data found")).toBeInTheDocument();
  });

  it("recomputes COGS from a package price and saves it", async () => {
    api.updateStockCogs.mockResolvedValue({ data: { success: true } });
    renderWithProviders(<StockManagement />, { preloadedState: asAdmin });

    fireEvent.click(within(await findRow("Susu Segar")).getByRole("button", { name: "Ubah" }));
    const dialog = screen.getByText("Ubah COGS Awal").closest("form");
    expect(within(dialog).getByPlaceholderText("Contoh: 800 ml")).toHaveValue("800");
    expect(within(dialog).getByPlaceholderText("Contoh: 169000")).toHaveValue("20.488");

    fireEvent.change(within(dialog).getByPlaceholderText("Contoh: 800 ml"), { target: { value: "1000" } });
    fireEvent.change(within(dialog).getByPlaceholderText("Contoh: 169000"), { target: { value: "30.000" } });
    expect(dialog).toHaveTextContent("Rp 24.000 - Rp 30 / ml");
    fireEvent.change(within(dialog).getByPlaceholderText("Contoh: Setup COGS Awal"), { target: { value: "Setup" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));

    await waitFor(() =>
      expect(api.updateStockCogs.mock.calls[0][0]).toEqual({ stockItemId: 1, averageCost: 30, supplier: "Setup" })
    );
    expect(await screen.findByText("COGS awal berhasil diubah.")).toBeInTheDocument();
  });

  it("rejects an invalid package quantity", async () => {
    renderWithProviders(<StockManagement />, { preloadedState: asAdmin });

    fireEvent.click(within(await findRow("Air Galon")).getByRole("button", { name: "Ubah" }));
    const dialog = screen.getByText("Ubah COGS Awal").closest("form");
    fireEvent.change(within(dialog).getByPlaceholderText("Contoh: 800 pcs"), { target: { value: "0" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));

    expect(await screen.findByText("Gramasi kemasan tidak valid.")).toBeInTheDocument();
    expect(api.updateStockCogs).not.toHaveBeenCalled();
  });

  it("deletes after confirmation and hides admin actions from cashiers", async () => {
    api.deleteStockItem.mockResolvedValue({ data: { success: true } });
    const { unmount } = renderWithProviders(<StockManagement />, { preloadedState: asAdmin });

    fireEvent.click(within(await findRow("Air Galon")).getByRole("button", { name: "Hapus" }));
    expect(screen.getByText("Hapus bahan?").parentElement).toHaveTextContent("Bahan Air Galon akan dihapus dari daftar stok.");
    fireEvent.click(within(screen.getByText("Hapus bahan?").parentElement).getByRole("button", { name: "Hapus" }));
    await waitFor(() => expect(api.deleteStockItem.mock.calls[0][0]).toBe(2));
    unmount();

    renderWithProviders(<StockManagement />, { preloadedState: asCashier });
    await screen.findByText("Air Galon");
    expect(screen.queryByRole("button", { name: "Ubah" })).not.toBeInTheDocument();
    expect(screen.queryByText("Aksi")).not.toBeInTheDocument();
  });
});
