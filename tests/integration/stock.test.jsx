import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import { StockManagement } from "../../src/features/inventory";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  addSemiItem: vi.fn(),
  deleteSemiItem: vi.fn(),
  deleteSemiProduction: vi.fn(),
  deleteStockItem: vi.fn(),
  getPurchases: vi.fn(),
  getSemiItems: vi.fn(),
  getSemiProductions: vi.fn(),
  getShoppingSuppliers: vi.fn(),
  getStockItems: vi.fn(),
  recordSemiProduction: vi.fn(),
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

// Bahan setengah jadi made from "Bahan 03" (1 pcs per recipe), served by its
// own endpoint and never listed in Stok Barang.
const nasi = stockItem(20, {
  name: "Nasi",
  category: "Olahan",
  unit: "porsi",
  stock: 78,
  minimumStock: 0,
  averageCost: 875,
  stockValue: 68250,
  portionSize: 150,
  yieldQuantity: 16,
  recipeCost: 1000,
  components: [{ stockItemId: 3, name: "Bahan 03", unit: "pcs", quantity: 1, unitCost: 1000, cost: 1000 }],
  lastProduction: { id: 7, producedAt: "2026-10-28 08:00:00", batchQuantity: 5, portionQuantity: 80, cost: 70000, unitCost: 875 },
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
    api.getSemiItems.mockResolvedValue({ data: { data: [nasi] } });
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

  it("lists bahan setengah jadi in their own tab, not in Stok Barang", async () => {
    renderWithProviders(<StockManagement />, { preloadedState: asAdmin });

    await findRow("Susu Segar");
    expect(screen.queryByText("Nasi")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Bahan Setengah Jadi" }));
    const row = rowOf("Nasi");
    expect(row).toHaveTextContent("1 resep: Bahan 03 1 pcs · Rp 1.000");
    expect(row).toHaveTextContent("150 gr");
    expect(row).toHaveTextContent("16 porsi / resep");
    expect(row).toHaveTextContent("78 porsi");
    expect(row).toHaveTextContent("Rp 68.250");
    expect(row).toHaveTextContent("Rp 875 / porsi");

    // Deleting goes to the semi item endpoint, not the bahan baku one.
    api.deleteSemiItem.mockResolvedValue({ data: { success: true } });
    fireEvent.click(within(row).getByRole("button", { name: "Hapus" }));
    fireEvent.click(within(screen.getByText("Hapus bahan?").parentElement).getByRole("button", { name: "Hapus" }));
    await waitFor(() => expect(api.deleteSemiItem.mock.calls[0][0]).toBe(20));
    expect(api.deleteStockItem).not.toHaveBeenCalled();
  });

  it("adds a bahan setengah jadi from bahan baku only", async () => {
    api.addSemiItem.mockResolvedValue({ data: { success: true } });
    renderWithProviders(<StockManagement />, { preloadedState: asAdmin });

    await findRow("Susu Segar");
    fireEvent.click(screen.getByRole("button", { name: "Bahan Setengah Jadi" }));
    fireEvent.click(screen.getByRole("button", { name: "Tambah Bahan Setengah Jadi" }));
    const dialog = screen.getByRole("form", { name: "Form bahan setengah jadi" });
    const ingredient = within(dialog).getByRole("combobox", { name: "Bahan 1" });
    expect(within(ingredient).queryByRole("option", { name: "Nasi" })).not.toBeInTheDocument();

    fireEvent.change(within(dialog).getByPlaceholderText("Contoh: Nasi"), { target: { value: "Sambal" } });
    fireEvent.change(within(dialog).getByPlaceholderText("Contoh: 150"), { target: { value: "25" } });
    fireEvent.change(ingredient, { target: { value: "1" } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Takaran bahan 1" }), { target: { value: "500" } });
    expect(dialog).toHaveTextContent("ml");
    expect(dialog).toHaveTextContent("Rp 12.805");
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));

    await waitFor(() =>
      expect(api.addSemiItem.mock.calls[0][0]).toEqual({
        name: "Sambal",
        unit: "porsi",
        portionSize: 25,
        minimumStock: 0,
        components: [{ stockItemId: 1, quantity: 500 }],
      })
    );
    expect(await screen.findByText("Bahan setengah jadi ditambahkan.")).toBeInTheDocument();
  });

  it("lets cashiers record a cooking from the weighed result", async () => {
    api.recordSemiProduction.mockResolvedValue({ data: { success: true } });
    renderWithProviders(<StockManagement />, { preloadedState: asCashier });

    await findRow("Susu Segar");
    fireEvent.click(screen.getByRole("button", { name: "Bahan Setengah Jadi" }));
    expect(screen.queryByRole("button", { name: "Tambah Bahan Setengah Jadi" })).not.toBeInTheDocument();
    expect(within(rowOf("Nasi")).queryByRole("button", { name: "Ubah" })).not.toBeInTheDocument();
    fireEvent.click(within(rowOf("Nasi")).getByRole("button", { name: "Catat Masak" }));

    const dialog = screen.getByRole("form", { name: "Form catat masak" });
    fireEvent.change(within(dialog).getByPlaceholderText("Contoh: 5"), { target: { value: "20" } });
    expect(dialog).toHaveTextContent("stok kurang, sisa 10 pcs");
    expect(within(dialog).getByRole("button", { name: "Simpan" })).toBeDisabled();

    // 5 recipes use 5 pcs (Rp 5.000); 3.000 gr / 150 gr = 20 portions.
    fireEvent.change(within(dialog).getByPlaceholderText("Contoh: 5"), { target: { value: "5" } });
    fireEvent.change(within(dialog).getByPlaceholderText("Contoh: 12000"), { target: { value: "3000" } });
    expect(dialog).toHaveTextContent("Bahan 03 5 pcs");
    expect(dialog).toHaveTextContent("20 porsi");
    expect(dialog).toHaveTextContent("4 porsi / resep");
    expect(dialog).toHaveTextContent("Rp 5.000");
    expect(dialog).toHaveTextContent("Rp 250");
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));

    await waitFor(() =>
      expect(api.recordSemiProduction.mock.calls[0][0]).toEqual({
        semiItemId: 20,
        batchQuantity: 5,
        outputWeight: 3000,
        note: "",
      })
    );
    expect(await screen.findByText("Catatan masak disimpan.")).toBeInTheDocument();
  });

  it("shows the cooking history and lets admins undo only the latest", async () => {
    api.getSemiProductions.mockResolvedValue({
      data: {
        data: [
          { id: 8, batchQuantity: 1, outputWeight: null, portionQuantity: 15, cost: 1000, unitCost: 67, producedAt: "2026-10-28 14:00:00", userName: "Admin", note: "dibagi langsung", items: [{ stockItemId: 3, name: "Bahan 03", quantity: 1, unit: "pcs" }] },
          { id: 7, batchQuantity: 5, outputWeight: 12000, portionQuantity: 80, cost: 70000, unitCost: 875, producedAt: "2026-10-28 08:00:00", userName: "Admin", note: "", items: [{ stockItemId: 3, name: "Bahan 03", quantity: 5, unit: "pcs" }] },
        ],
      },
    });
    api.deleteSemiProduction.mockResolvedValue({ data: { success: true } });
    renderWithProviders(<StockManagement />, { preloadedState: asAdmin });

    await findRow("Susu Segar");
    fireEvent.click(screen.getByRole("button", { name: "Bahan Setengah Jadi" }));
    fireEvent.click(within(rowOf("Nasi")).getByRole("button", { name: "Riwayat" }));

    const dialog = await screen.findByRole("dialog", { name: "Riwayat masak Nasi" });
    expect(await within(dialog).findByText("dibagi langsung")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("5 resep → 80 porsi");
    expect(dialog).toHaveTextContent("ditimbang 12.000 gr");
    expect(within(dialog).getAllByRole("button", { name: "Batalkan" })).toHaveLength(1);

    fireEvent.click(within(dialog).getByRole("button", { name: "Batalkan" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Ya, batalkan" }));
    await waitFor(() => expect(api.deleteSemiProduction.mock.calls[0][0]).toBe(8));
  });
});
