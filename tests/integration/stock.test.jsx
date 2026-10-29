import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import { StockManagement } from "../../src/features/inventory";
import StockCogsDialog from "../../src/features/inventory/components/stock/StockCogsDialog";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  addStockItem: vi.fn(),
  addSemiItem: vi.fn(),
  deleteSemiItem: vi.fn(),
  deleteSemiProduction: vi.fn(),
  deleteSemiWaste: vi.fn(),
  deleteStockItem: vi.fn(),
  deleteSupplyItem: vi.fn(),
  getPurchases: vi.fn(),
  getSemiItems: vi.fn(),
  getSemiProductions: vi.fn(),
  getSemiWastes: vi.fn(),
  getShoppingSuppliers: vi.fn(),
  getStockItems: vi.fn(),
  getSupplyItems: vi.fn(),
  recordSemiProduction: vi.fn(),
  recordSemiWaste: vi.fn(),
  updateSemiStock: vi.fn(),
  updateStockCogs: vi.fn(),
  updateSupplyItem: vi.fn(),
  updateSupplyStock: vi.fn(),
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
// own endpoint and never listed under Bahan Baku.
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
    api.getSupplyItems.mockResolvedValue({ data: { data: [] } });
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

  it("adds a stock item from Tambah Stok", async () => {
    api.addStockItem.mockResolvedValue({ data: { success: true } });
    renderWithProviders(<StockManagement />, { preloadedState: asAdmin });

    fireEvent.click(await screen.findByRole("button", { name: "Tambah Stok" }));
    const dialog = screen.getByRole("dialog", { name: "Tambah Stok" });
    fireEvent.change(within(dialog).getByLabelText("Bahan"), { target: { value: "  Sirup   Vanila " } });
    fireEvent.change(within(dialog).getByLabelText("Kategori"), { target: { value: "Sirup" } });
    fireEvent.change(within(dialog).getByLabelText("Satuan"), { target: { value: "ML" } });
    fireEvent.change(within(dialog).getByLabelText("Minimum"), { target: { value: "250" } });
    fireEvent.change(within(dialog).getByLabelText("Supplier"), { target: { value: "Toko Sirup" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Tambah Stok" }));

    await waitFor(() =>
      expect(api.addStockItem.mock.calls[0][0]).toEqual({
        name: "Sirup Vanila",
        category: "Sirup",
        unit: "ml",
        stock: 0,
        minimumStock: 250,
        supplier: "Toko Sirup",
        isUnlimited: false,
      })
    );
    expect(await screen.findByText("Bahan berhasil ditambahkan.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Tambah Stok" })).not.toBeInTheDocument());
  });

  it("validates Tambah Stok and shows the server message for a taken name", async () => {
    api.addStockItem.mockRejectedValue({ response: { data: { message: "Bahan Susu Segar sudah ada di Stok → Bahan Baku." } } });
    renderWithProviders(<StockManagement />, { preloadedState: asAdmin });

    fireEvent.click(await screen.findByRole("button", { name: "Tambah Stok" }));
    const dialog = screen.getByRole("dialog", { name: "Tambah Stok" });
    fireEvent.change(within(dialog).getByLabelText("Bahan"), { target: { value: "Susu Segar" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Tambah Stok" }));
    expect(await screen.findByText("Bahan, kategori, dan satuan wajib diisi.")).toBeInTheDocument();
    expect(api.addStockItem).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText("Kategori"), { target: { value: "Dairy" } });
    fireEvent.change(within(dialog).getByLabelText("Satuan"), { target: { value: "ml" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Tambah Stok" }));
    expect(await screen.findByText("Bahan Susu Segar sudah ada di Stok → Bahan Baku.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Tambah Stok" })).toBeInTheDocument();
  });

  it("hides Ubah on Bahan Baku but keeps Hapus", async () => {
    renderWithProviders(<StockManagement />, { preloadedState: asAdmin });

    const row = await findRow("Susu Segar");
    expect(within(row).queryByRole("button", { name: "Ubah" })).not.toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Hapus" })).toBeInTheDocument();
  });

  // The COGS dialog stays for when Ubah is shown again.
  it("recomputes COGS from a package price and saves it", async () => {
    const onSave = vi.fn();
    render(<StockCogsDialog item={items[0]} onSave={onSave} onCancel={vi.fn()} isSaving={false} />);
    const dialog = screen.getByText("Ubah COGS Awal").closest("form");
    expect(within(dialog).getByPlaceholderText("Contoh: 800 ml")).toHaveValue("800");
    expect(within(dialog).getByPlaceholderText("Contoh: 169000")).toHaveValue("20.488");

    fireEvent.change(within(dialog).getByPlaceholderText("Contoh: 800 ml"), { target: { value: "1000" } });
    fireEvent.change(within(dialog).getByPlaceholderText("Contoh: 169000"), { target: { value: "30.000" } });
    expect(dialog).toHaveTextContent("Rp 24.000 - Rp 30 / ml");
    fireEvent.change(within(dialog).getByPlaceholderText("Contoh: Setup COGS Awal"), { target: { value: "Setup" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));

    expect(onSave).toHaveBeenCalledWith({ averageCost: 30, supplier: "Setup" });
  });

  it("rejects an invalid package quantity", async () => {
    const onSave = vi.fn();
    renderWithProviders(<StockCogsDialog item={items[1]} onSave={onSave} onCancel={vi.fn()} isSaving={false} />);
    const dialog = screen.getByText("Ubah COGS Awal").closest("form");
    fireEvent.change(within(dialog).getByPlaceholderText("Contoh: 800 pcs"), { target: { value: "0" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));

    expect(await screen.findByText("Gramasi kemasan tidak valid.")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
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
    expect(screen.queryByRole("button", { name: "Tambah Stok" })).not.toBeInTheDocument();
    expect(screen.queryByText("Aksi")).not.toBeInTheDocument();
  });

  it("lists bahan setengah jadi in their own tab, not under Bahan Baku", async () => {
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
    // Sambal keeps for days: no daily write-off.
    const resetDaily = within(dialog).getByRole("checkbox", { name: /Habis setiap hari/ });
    expect(resetDaily).toBeChecked();
    fireEvent.click(resetDaily);
    expect(dialog).toHaveTextContent("ml");
    expect(dialog).toHaveTextContent("Rp 12.805");
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));

    await waitFor(() =>
      expect(api.addSemiItem.mock.calls[0][0]).toEqual({
        name: "Sambal",
        unit: "porsi",
        portionSize: 25,
        minimumStock: 0,
        resetDaily: false,
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

  it("lets cashiers throw portions away and shows the kerugian", async () => {
    api.recordSemiWaste.mockResolvedValue({ data: { success: true } });
    renderWithProviders(<StockManagement />, { preloadedState: asCashier });

    await findRow("Susu Segar");
    fireEvent.click(screen.getByRole("button", { name: "Bahan Setengah Jadi" }));
    fireEvent.click(within(rowOf("Nasi")).getByRole("button", { name: "Buang" }));

    const dialog = screen.getByRole("form", { name: "Form buang porsi" });
    const quantity = within(dialog).getByPlaceholderText("Contoh: 5");
    fireEvent.change(quantity, { target: { value: "80" } });
    expect(dialog).toHaveTextContent("Lebih dari sisa stok (78 porsi)");
    expect(within(dialog).getByRole("button", { name: "Buang" })).toBeDisabled();

    // 5 of 78 portions worth Rp 68.250: Rp 4.375.
    fireEvent.change(quantity, { target: { value: "5" } });
    expect(dialog).toHaveTextContent("Rp 4.375");
    fireEvent.change(within(dialog).getByRole("combobox", { name: "Alasan" }), { target: { value: "Tumpah" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Buang" }));

    await waitFor(() =>
      expect(api.recordSemiWaste.mock.calls[0][0]).toEqual({
        semiItemId: 20,
        quantity: 5,
        reason: "Tumpah",
        note: "",
      })
    );
    expect(await screen.findByText("Kerugian dicatat.")).toBeInTheDocument();
  });

  it("warns that a lower stock count becomes kerugian", async () => {
    api.updateSemiStock.mockResolvedValue({ data: { success: true } });
    renderWithProviders(<StockManagement />, { preloadedState: asAdmin });

    await findRow("Susu Segar");
    fireEvent.click(screen.getByRole("button", { name: "Bahan Setengah Jadi" }));
    fireEvent.click(within(rowOf("Nasi")).getByRole("button", { name: "Sesuaikan" }));

    const dialog = screen.getByRole("form", { name: "Form sesuaikan stok" });
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "70" } });
    expect(dialog).toHaveTextContent("Kurang 8 porsi dicatat sebagai kerugian (Penyesuaian): Rp 7.000");
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));
    await waitFor(() => expect(api.updateSemiStock.mock.calls[0][0]).toEqual({ semiItemId: 20, stock: 70 }));
  });

  it("lists the kerugian per day and lets admins undo the latest write-off of an item", async () => {
    api.getSemiWastes.mockResolvedValue({
      data: {
        data: {
          wastes: [
            { id: 12, semiItemId: 20, itemName: "Nasi", wasteDate: "2026-10-28", quantity: 70, unit: "porsi", cost: 61250, reason: "Sisa akhir hari", note: "", userName: "Admin", createdAt: "2026-10-28 22:00:00" },
            { id: 11, semiItemId: 20, itemName: "Nasi", wasteDate: "2026-10-28", quantity: 8, unit: "porsi", cost: 7000, reason: "Penyesuaian", note: "", userName: "Admin", createdAt: "2026-10-28 15:00:00" },
          ],
          dailyTotals: [{ date: "2026-10-28", cost: 68250, entries: 2 }],
        },
      },
    });
    api.deleteSemiWaste.mockResolvedValue({ data: { success: true } });
    renderWithProviders(<StockManagement />, { preloadedState: asAdmin });

    await findRow("Susu Segar");
    fireEvent.click(screen.getByRole("button", { name: "Bahan Setengah Jadi" }));
    fireEvent.click(screen.getByRole("button", { name: "Riwayat Kerugian" }));

    const dialog = await screen.findByRole("dialog", { name: "Riwayat kerugian" });
    expect(await within(dialog).findByText("Sisa akhir hari")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Kerugian per hari");
    expect(dialog).toHaveTextContent("Rp 68.250");
    expect(dialog).toHaveTextContent("Nasi · 70 porsi");
    expect(within(dialog).getAllByRole("button", { name: "Batalkan" })).toHaveLength(1);

    fireEvent.click(within(dialog).getByRole("button", { name: "Batalkan" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Ya, kembalikan ke stok" }));
    await waitFor(() => expect(api.deleteSemiWaste.mock.calls[0][0]).toBe(12));
  });
});

describe("perlengkapan tab", () => {
  const supplies = [
    stockItem(31, { name: "Gas LPG", category: "Operasional", unit: "tabung", stock: 3, minimumStock: 1, averageCost: 22000, stockValue: 66000, status: "AMAN" }),
    stockItem(32, { name: "Blender", category: "Peralatan", unit: "unit", stock: 1, minimumStock: 1, averageCost: 700000, stockValue: 700000, status: "HARUS ORDER" }),
    stockItem(33, { name: "Iklan IG", category: "Promosi", unit: "paket", stockValue: 0, isUnlimited: true, status: "BEBAS STOK" }),
  ];
  const openSupplyTab = async (preloadedState = asAdmin) => {
    renderWithProviders(<StockManagement />, { preloadedState });
    fireEvent.click(screen.getByRole("button", { name: "Perlengkapan" }));
    return findRow("Gas LPG");
  };

  beforeEach(() => {
    api.getStockItems.mockResolvedValue({ data: { data: items } });
    api.getSemiItems.mockResolvedValue({ data: { data: [] } });
    api.getSupplyItems.mockResolvedValue({ data: { data: supplies } });
  });

  it("lists perlengkapan by category with their value and no separate create button", async () => {
    const gas = await openSupplyTab();
    expect(gas).toHaveTextContent("Operasional");
    expect(gas).toHaveTextContent("Rp 66.000");
    expect(rowOf("Iklan IG")).toHaveTextContent("Bebas Stok");
    expect(screen.getByText(/Nilai perlengkapan/)).toHaveTextContent("Rp 766.000");
    expect(screen.queryByRole("button", { name: /Tambah/ })).not.toBeInTheDocument();
    // Bahan baku never show up in Perlengkapan.
    expect(screen.queryByText("Susu Segar")).not.toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("group", { name: "Kategori perlengkapan" })).getByRole("button", { name: "Peralatan" }));
    expect(screen.queryByText("Gas LPG")).not.toBeInTheDocument();
    expect(rowOf("Blender")).toHaveTextContent("HARUS ORDER");
    expect(screen.getByText(/Nilai perlengkapan/)).toHaveTextContent("Rp 700.000");
  });

  it("adjusts the counted stock, edits and deletes a perlengkapan", async () => {
    api.updateSupplyStock.mockResolvedValue({ data: { success: true } });
    api.updateSupplyItem.mockResolvedValue({ data: { success: true } });
    api.deleteSupplyItem.mockResolvedValue({ data: { success: true } });
    const gas = await openSupplyTab();

    fireEvent.click(within(gas).getByRole("button", { name: "Sesuaikan" }));
    const adjust = screen.getByRole("dialog", { name: "Sesuaikan Gas LPG" });
    fireEvent.change(within(adjust).getByLabelText("Stok Sekarang (tabung)"), { target: { value: "1" } });
    expect(adjust).toHaveTextContent("Rp 22.000");
    fireEvent.click(within(adjust).getByRole("button", { name: "Simpan" }));
    await waitFor(() => expect(api.updateSupplyStock.mock.calls[0][0]).toEqual({ supplyItemId: 31, stock: 1 }));

    fireEvent.click(within(rowOf("Gas LPG")).getByRole("button", { name: "Ubah" }));
    const edit = screen.getByRole("dialog", { name: "Ubah Perlengkapan" });
    fireEvent.change(within(edit).getByLabelText("Nama"), { target: { value: "Gas LPG 3 kg" } });
    fireEvent.change(within(edit).getByLabelText("Minimum"), { target: { value: "2" } });
    fireEvent.click(within(edit).getByRole("button", { name: "Simpan" }));
    await waitFor(() =>
      expect(api.updateSupplyItem.mock.calls[0][0]).toEqual({
        supplyItemId: 31,
        name: "Gas LPG 3 kg",
        category: "Operasional",
        unit: "tabung",
        minimumStock: 2,
        supplier: "",
        isUnlimited: false,
      })
    );

    fireEvent.click(within(rowOf("Blender")).getByRole("button", { name: "Hapus" }));
    fireEvent.click(within(screen.getByText("Hapus bahan?").parentElement).getByRole("button", { name: "Hapus" }));
    await waitFor(() => expect(api.deleteSupplyItem.mock.calls[0][0]).toBe(32));
  });

  it("lets cashiers count perlengkapan but not change them", async () => {
    const gas = await openSupplyTab(asCashier);
    expect(within(gas).getByRole("button", { name: "Sesuaikan" })).toBeInTheDocument();
    expect(within(gas).queryByRole("button", { name: "Ubah" })).not.toBeInTheDocument();
    expect(within(gas).queryByRole("button", { name: "Hapus" })).not.toBeInTheDocument();
  });
});
