import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import { StockManagement } from "../../src/features/inventory";
import StockCogsDialog from "../../src/features/inventory/components/stock/StockCogsDialog";
import * as receiptImages from "../../src/features/inventory/utils/receiptImages";
import { getJakartaDateKey } from "../../src/shared/lib/dates";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  addSemiItem: vi.fn(),
  deleteSemiItem: vi.fn(),
  deleteSemiProduction: vi.fn(),
  deleteSemiWaste: vi.fn(),
  deleteStockItem: vi.fn(),
  deleteStockOpname: vi.fn(),
  deleteStockWaste: vi.fn(),
  getPurchases: vi.fn(),
  getSemiItems: vi.fn(),
  getSemiProductions: vi.fn(),
  getShoppingSuppliers: vi.fn(),
  getStockItems: vi.fn(),
  getStockOpnameUsage: vi.fn(),
  getStockOpnames: vi.fn(),
  getStockWastes: vi.fn(),
  getSupplyItems: vi.fn(),
  recordSemiProduction: vi.fn(),
  recordSemiWaste: vi.fn(),
  recordStockOpname: vi.fn(),
  recordStockWaste: vi.fn(),
  updateStockCogs: vi.fn(),
  updateStockRecipeUse: vi.fn(),
}));

// jsdom cannot decode images: bukti foto are sent as picked.
vi.mock("../../src/features/inventory/utils/receiptImages", async (importOriginal) => ({
  ...(await importOriginal()),
  compressReceiptImage: vi.fn(),
}));

const photo = (name) => new File(["x"], name, { type: "image/jpeg" });

// A write-off of Nasi as Riwayat Kerugian lists it.
const semiWaste = (id, overrides = {}) => ({
  id,
  kind: "semi",
  itemId: 20,
  semiItemId: 20,
  itemName: "Nasi",
  wasteDate: "2026-10-28",
  unit: "porsi",
  note: "",
  userName: "Admin",
  createdAt: "2026-10-28 10:00:00",
  photos: [],
  ...overrides,
});

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

// Bahan olahan made from "Bahan 03" (1 pcs per recipe), served by its
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
  stockItem(1, { name: "Susu Segar", unit: "ml", stock: 800, averageCost: 25.61, stockValue: 20488, supplier: "Toko Susu", status: "HAMPIR HABIS", isRecipeIngredient: true }),
  stockItem(2, { name: "Air Galon", isUnlimited: true, status: "BEBAS STOK", isRecipeIngredient: false }),
  ...Array.from({ length: 10 }, (_, index) => stockItem(index + 3)),
];
// From the rekap import: bought and stocked by the galon.
const asAdmin = { user: { _id: 1, name: "Admin", email: "a", phone: "1", role: "Admin", isAuth: true } };
const asCashier = { user: { ...asAdmin.user, role: "Cashier" } };
const rowOf = (name) => screen.getByText(name).closest("tr");
const findRow = async (name) => (await screen.findByText(name)).closest("tr");

describe("stock management", () => {
  beforeEach(() => {
    api.getStockItems.mockResolvedValue({ data: { data: items } });
    api.getSemiItems.mockResolvedValue({ data: { data: [nasi] } });
    api.getStockWastes.mockResolvedValue({ data: { data: { wastes: [], dailyTotals: [] } } });
    api.getStockOpnameUsage.mockResolvedValue({ data: { data: { usage: [] } } });
    receiptImages.compressReceiptImage.mockImplementation(async (file) => file);
    URL.createObjectURL = vi.fn((file) => `blob:${file.name}`);
    URL.revokeObjectURL = vi.fn();
    api.getPurchases.mockResolvedValue({ data: { data: { purchases: [], itemGroups: [], total: 0 } } });
    api.getShoppingSuppliers.mockResolvedValue({ data: { data: [] } });
  });

  it("Stock Opname: staff type only the fisik, the selisih and kehilangan follow", async () => {
    api.recordStockOpname.mockResolvedValue({ data: { success: true, message: "Stock opname disimpan." } });
    renderWithProviders(<StockManagement />, { preloadedState: asCashier });

    await findRow("Susu Segar");
    fireEvent.click(screen.getByRole("button", { name: "Stock Opname" }));
    const dialog = screen.getByRole("form", { name: "Form stock opname" });
    expect(dialog).toHaveTextContent("Stock Opname Bahan Baku");
    // Bebas Stok is not counted.
    expect(within(dialog).queryByText("Air Galon")).not.toBeInTheDocument();
    const fisik = (name) => within(dialog).getByRole("textbox", { name: `Fisik ${name}` });
    const lineOf = (name) => within(dialog).getByText(name).closest("tr");

    // Susu 100 ml kurang at Rp 25,61 / ml; Bahan 03 2 pcs lebih; Bahan 04 cocok.
    fireEvent.change(fisik("Susu Segar"), { target: { value: "700" } });
    fireEvent.change(fisik("Bahan 03"), { target: { value: "12" } });
    fireEvent.change(fisik("Bahan 04"), { target: { value: "10" } });
    expect(lineOf("Susu Segar")).toHaveTextContent("Kurang 100 ml");
    expect(lineOf("Susu Segar")).toHaveTextContent("-Rp 2.561");
    expect(lineOf("Bahan 03")).toHaveTextContent("Lebih 2 pcs");
    expect(lineOf("Bahan 03")).toHaveTextContent("+Rp 2.000");
    expect(lineOf("Bahan 04")).toHaveTextContent("Cocok");
    expect(dialog).toHaveTextContent("Dihitung3 bahan");
    expect(dialog).toHaveTextContent("Selisih2 bahan");
    expect(dialog).toHaveTextContent("Kehilangan PersediaanRp 561");

    // A count below 0 is refused.
    fireEvent.change(fisik("Bahan 05"), { target: { value: "-1" } });
    expect(lineOf("Bahan 05")).toHaveTextContent("Tidak valid");
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));
    expect(await screen.findByText("Stok fisik harus angka 0 atau lebih.")).toBeInTheDocument();
    fireEvent.change(fisik("Bahan 05"), { target: { value: "" } });

    // The search narrows the list but keeps the counts.
    fireEvent.change(within(dialog).getByRole("searchbox", { name: "Cari bahan" }), { target: { value: "susu" } });
    expect(within(dialog).queryByText("Bahan 03")).not.toBeInTheDocument();
    expect(dialog).toHaveTextContent("Dihitung3 bahan");

    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));
    expect(dialog).toHaveTextContent("Stok 2 bahan disesuaikan ke angka fisik.");
    expect(api.recordStockOpname).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Ya, Simpan" }));
    await waitFor(() =>
      expect(api.recordStockOpname.mock.calls[0][0]).toEqual({
        kind: "raw",
        counts: [
          { itemId: 1, actualStock: 700 },
          { itemId: 3, actualStock: 12 },
          { itemId: 4, actualStock: 10 },
        ],
        note: "",
      })
    );
    expect(await screen.findByText("Stock opname disimpan.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("form", { name: "Form stock opname" })).not.toBeInTheDocument());
  });

  it("Stock Opname opens on the bahan today's orders used, with how much", async () => {
    api.getStockItems.mockResolvedValue({
      data: { data: [...items, stockItem(13, { name: "Aqua Botol", isRecipeIngredient: false })] },
    });
    api.getStockOpnameUsage.mockResolvedValue({
      data: { data: { usage: [{ itemId: 1, quantity: 200 }, { itemId: 5, quantity: 3 }, { itemId: 2, quantity: 1 }] } },
    });
    renderWithProviders(<StockManagement />, { preloadedState: asCashier });

    await findRow("Susu Segar");
    fireEvent.click(screen.getByRole("button", { name: "Stock Opname" }));
    const dialog = screen.getByRole("form", { name: "Form stock opname" });
    await waitFor(() => expect(api.getStockOpnameUsage).toHaveBeenCalledWith("raw"));
    const used = await within(dialog).findByRole("button", { name: "Terpakai Pesanan (2)" });
    expect(used).toHaveAttribute("aria-pressed", "true");
    // Bebas Stok is not counted, even when orders used it.
    expect(within(dialog).queryByText("Air Galon")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Bahan 03")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Susu Segar").closest("tr")).toHaveTextContent("800 ml200 ml");
    expect(within(dialog).getByText("Bahan 05").closest("tr")).toHaveTextContent("10 pcs3 pcs");

    // Semua lists every bahan; a count typed before stays.
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Fisik Susu Segar" }), { target: { value: "590" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Semua (11)" }));
    // Only Bahan Resep are counted: not the Bukan Resep Aqua Botol.
    expect(within(dialog).queryByText("Aqua Botol")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Bahan 03").closest("tr")).toHaveTextContent("10 pcs-");
    expect(within(dialog).getByRole("textbox", { name: "Fisik Susu Segar" })).toHaveValue("590");
    expect(dialog).toHaveTextContent("Dihitung1 bahan");
  });

  it("Stock Opname of bahan olahan counts portions", async () => {
    api.recordStockOpname.mockResolvedValue({ data: { success: true, message: "Stock opname disimpan." } });
    renderWithProviders(<StockManagement />, { preloadedState: asAdmin });

    await findRow("Susu Segar");
    fireEvent.click(screen.getByRole("button", { name: "Bahan Olahan" }));
    fireEvent.click(screen.getByRole("button", { name: "Stock Opname" }));
    const dialog = screen.getByRole("form", { name: "Form stock opname" });
    expect(dialog).toHaveTextContent("Stock Opname Bahan Olahan");
    // Nasi: 78 porsi worth Rp 68.250, 70 counted.
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Fisik Nasi" }), { target: { value: "70" } });
    expect(within(dialog).getByText("Nasi").closest("tr")).toHaveTextContent("Kurang 8 porsi-Rp 7.000");
    fireEvent.change(within(dialog).getByPlaceholderText("Opsional"), { target: { value: "sisa malam" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Ya, Simpan" }));
    await waitFor(() =>
      expect(api.recordStockOpname.mock.calls[0][0]).toEqual({
        kind: "semi",
        counts: [{ itemId: 20, actualStock: 70 }],
        note: "sisa malam",
      })
    );
  });

  it("lists the Riwayat Opname of its tab and lets admins undo the latest count of an item", async () => {
    const today = getJakartaDateKey();
    const opname = (id, itemId, itemName, systemStock, actualStock, cost, unit = "ml") => ({
      id,
      kind: "raw",
      itemId,
      itemName,
      opnameDate: today,
      systemStock,
      actualStock,
      difference: systemStock - actualStock,
      unit,
      cost,
      note: "",
      userName: "Kasir",
      createdAt: `${today} 09:00:00`,
    });
    api.getStockOpnames.mockResolvedValue({
      data: {
        data: {
          opnames: [
            opname(5, 1, "Susu Segar", 700, 650, 1280),
            opname(4, 3, "Bahan 03", 10, 12, -2000, "pcs"),
            opname(3, 1, "Susu Segar", 800, 700, 2561),
          ],
          dailyTotals: [{ date: today, cost: 1841, entries: 3 }],
        },
      },
    });
    api.deleteStockOpname.mockResolvedValue({ data: { success: true } });
    renderWithProviders(<StockManagement />, { preloadedState: asAdmin });

    await findRow("Susu Segar");
    fireEvent.click(screen.getByRole("button", { name: "Riwayat Opname" }));
    const history = screen.getByRole("region", { name: "Riwayat opname" });
    await waitFor(() => expect(api.getStockOpnames).toHaveBeenCalledWith({ kind: "raw" }));
    const rows = await within(history).findAllByText("Susu Segar");
    expect(rows[0].closest("tr")).toHaveTextContent("700 ml650 mlkurang 50 ml");
    expect(within(history).getByText("Bahan 03").closest("tr")).toHaveTextContent("lebih 2 pcs");
    expect(within(history).getByText("Bahan 03").closest("tr")).toHaveTextContent("+Rp 2.000");
    expect(within(history).getByRole("list", { name: "Total nilai selisih" })).toHaveTextContent("Hari ini-Rp 1.841");

    // Only the latest count of each item can be undone.
    expect(within(rows[1].closest("tr")).queryByRole("button", { name: "Batalkan" })).not.toBeInTheDocument();
    fireEvent.click(within(rows[0].closest("tr")).getByRole("button", { name: "Batalkan" }));
    fireEvent.click(within(history).getByRole("button", { name: "Ya, batalkan" }));
    await waitFor(() => expect(api.deleteStockOpname.mock.calls[0][0]).toEqual({ kind: "raw", id: 5 }));

    fireEvent.click(within(history).getByRole("button", { name: "Kembali" }));
    expect(await findRow("Susu Segar")).toBeInTheDocument();
  });

  it("has no Lainnya tab: barang Lainnya are seen in Belanja Bahan", async () => {
    renderWithProviders(<StockManagement />, { preloadedState: asAdmin });

    await findRow("Susu Segar");
    expect(screen.getByRole("button", { name: "Bahan Baku" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bahan Olahan" })).toBeInTheDocument();
    // Riwayat Kerugian is a button inside the tab's panel, not a tab.
    const tabs = screen.getByRole("button", { name: "Bahan Baku" }).parentElement;
    expect(within(tabs).queryByRole("button", { name: "Riwayat Kerugian" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lainnya" })).not.toBeInTheDocument();
    expect(api.getSupplyItems).not.toHaveBeenCalled();
  });

  it("lists stock with status, value and cost per unit, paginated and searchable", async () => {
    renderWithProviders(<StockManagement />, { preloadedState: asAdmin });

    const milk = await findRow("Susu Segar");
    expect(milk).toHaveTextContent("Toko Susu");
    expect(milk).toHaveTextContent("Rp 20.488");
    expect(milk).toHaveTextContent("Rp 26 / ml");
    expect(milk).toHaveTextContent("HAMPIR HABIS");
    expect(rowOf("Air Galon")).toHaveTextContent("Bebas Stok");
    // Bebas Stok has no asset value (its Rp 10.000 is not shown).
    expect(rowOf("Air Galon")).not.toHaveTextContent("Rp 10.000");
    // Not a Bahan Resep: no COGS.
    expect(milk.cells[5]).toHaveTextContent("Rp 26 / ml");
    expect(rowOf("Air Galon").cells[5]).toHaveTextContent(/^-$/);
    expect(screen.getByText(/^Showing/)).toHaveTextContent("Showing 1 - 10 of 12");
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(/^Showing/)).toHaveTextContent("Showing 11 - 12 of 12");

    fireEvent.change(screen.getByPlaceholderText("Search stock"), { target: { value: "toko susu" } });
    expect(screen.getByText(/^Showing/)).toHaveTextContent("Showing 1 - 1 of 1");

    fireEvent.change(screen.getByPlaceholderText("Search stock"), { target: { value: "zzz" } });
    expect(screen.getByText("No stock data found")).toBeInTheDocument();
  });

  it("has no Tambah Stok: a new bahan baku comes from Tambah Belanja Bahan", async () => {
    renderWithProviders(<StockManagement />, { preloadedState: asAdmin });

    await findRow("Susu Segar");
    expect(screen.queryByRole("button", { name: "Tambah Stok" })).not.toBeInTheDocument();
  });

  it("hides Ubah and Konversi Satuan on Bahan Baku but keeps Hapus", async () => {
    renderWithProviders(<StockManagement />, { preloadedState: asAdmin });

    const row = await findRow("Susu Segar");
    expect(within(row).queryByRole("button", { name: "Ubah" })).not.toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: /Konversi/i })).not.toBeInTheDocument();
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
    expect(screen.queryByRole("button", { name: "Hapus" })).not.toBeInTheDocument();
    // Kasir may only throw bahan away; Bebas Stok has nothing to throw away.
    expect(within(rowOf("Susu Segar")).getByRole("button", { name: "Buang" })).toBeEnabled();
    expect(within(rowOf("Air Galon")).queryByRole("button", { name: "Buang" })).not.toBeInTheDocument();
    // Kasir sees Bahan Resep but cannot switch it.
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(rowOf("Air Galon")).toHaveTextContent("Tidak");
    expect(rowOf("Susu Segar")).toHaveTextContent("Ya");
  });

  it("filters and switches Bahan Resep, and offers only bahan resep to a bahan olahan", async () => {
    api.updateStockRecipeUse
      .mockRejectedValueOnce({ response: { data: { message: "Bahan masih dipakai di resep: Latte. Hapus dari resep terlebih dahulu." } } })
      .mockResolvedValueOnce({ data: { message: "Bahan ditandai sebagai bahan resep." } });
    renderWithProviders(<StockManagement />, { preloadedState: asAdmin });

    const milkSwitch = within(await findRow("Susu Segar")).getByRole("switch", { name: "Bahan Resep Susu Segar" });
    expect(milkSwitch).toHaveTextContent("Ya");
    expect(milkSwitch).toHaveAttribute("aria-checked", "true");
    const galonSwitch = within(rowOf("Air Galon")).getByRole("switch", { name: "Bahan Resep Air Galon" });
    expect(galonSwitch).toHaveTextContent("Tidak");

    const filters = screen.getByRole("group", { name: "Filter Bahan Resep" });
    fireEvent.click(within(filters).getByRole("button", { name: "Bukan Resep" }));
    expect(screen.getByText(/^Showing/)).toHaveTextContent("Showing 1 - 1 of 1");
    expect(screen.queryByText("Susu Segar")).not.toBeInTheDocument();
    // Bahan without the flag (older data) count as bahan resep.
    fireEvent.click(within(filters).getByRole("button", { name: "Bahan Resep" }));
    expect(screen.getByText(/^Showing/)).toHaveTextContent("Showing 1 - 10 of 11");
    expect(screen.queryByText("Air Galon")).not.toBeInTheDocument();
    fireEvent.click(within(filters).getByRole("button", { name: "Semua" }));
    expect(screen.getByText(/^Showing/)).toHaveTextContent("Showing 1 - 10 of 12");

    // A bahan a recipe uses stays on: the server says why.
    fireEvent.click(within(rowOf("Susu Segar")).getByRole("switch", { name: "Bahan Resep Susu Segar" }));
    await waitFor(() => expect(api.updateStockRecipeUse.mock.calls[0][0]).toEqual({ stockItemId: 1, isRecipeIngredient: false }));
    expect(await screen.findByText("Bahan masih dipakai di resep: Latte. Hapus dari resep terlebih dahulu.")).toBeInTheDocument();
    fireEvent.click(within(rowOf("Air Galon")).getByRole("switch", { name: "Bahan Resep Air Galon" }));
    await waitFor(() => expect(api.updateStockRecipeUse.mock.calls[1][0]).toEqual({ stockItemId: 2, isRecipeIngredient: true }));
    expect(await screen.findByText("Bahan ditandai sebagai bahan resep.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Bahan Olahan" }));
    fireEvent.click(screen.getByRole("button", { name: "Tambah Bahan Olahan" }));
    const dialog = screen.getByRole("form", { name: "Form bahan olahan" });
    const ingredient = within(dialog).getByRole("combobox", { name: "Bahan 1" });
    expect(within(ingredient).getByRole("option", { name: "Susu Segar" })).toBeInTheDocument();
    expect(within(ingredient).queryByRole("option", { name: "Air Galon" })).not.toBeInTheDocument();
  });

  it("lists bahan olahan in their own tab, not under Bahan Baku", async () => {
    renderWithProviders(<StockManagement />, { preloadedState: asAdmin });

    await findRow("Susu Segar");
    expect(screen.queryByText("Nasi")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Bahan Olahan" }));
    const row = rowOf("Nasi");
    expect(row).toHaveTextContent("Tahan lama");
    expect(row).toHaveTextContent("Bahan: Bahan 03");
    expect(row).not.toHaveTextContent("1x masak");
    expect(row).not.toHaveTextContent("150 gr");
    expect(row).toHaveTextContent("80 porsi");
    // Recounting leftover portions (Sesuaikan) is not offered.
    expect(within(row).queryByRole("button", { name: "Sesuaikan" })).not.toBeInTheDocument();
    // The last cooking's cost per portion; COGS Sekarang is the same (no older portions left).
    expect(row).toHaveTextContent("COGS Rp 875 / porsi");
    expect(row).not.toHaveTextContent("ada sisa masak sebelumnya");
    expect(row).toHaveTextContent("78 porsi");
    // No minimum stock: a status shows only once the stock is empty.
    expect(row).not.toHaveTextContent("AMAN");
    expect(row).toHaveTextContent("Rp 68.250");
    expect(row).toHaveTextContent("Rp 875 / porsi");

    // Deleting goes to the semi item endpoint, not the bahan baku one.
    api.deleteSemiItem.mockResolvedValue({ data: { success: true } });
    fireEvent.click(within(row).getByRole("button", { name: "Hapus" }));
    fireEvent.click(within(screen.getByText("Hapus bahan?").parentElement).getByRole("button", { name: "Hapus" }));
    await waitFor(() => expect(api.deleteSemiItem.mock.calls[0][0]).toBe(20));
    expect(api.deleteStockItem).not.toHaveBeenCalled();
  });

  it("marks a bahan olahan with no portions left as HARUS MASAK", async () => {
    api.getSemiItems.mockResolvedValue({ data: { data: [{ ...nasi, stock: 0, stockValue: 0, status: "HARUS MASAK" }] } });
    renderWithProviders(<StockManagement />, { preloadedState: asAdmin });

    await findRow("Susu Segar");
    fireEvent.click(screen.getByRole("button", { name: "Bahan Olahan" }));
    expect(rowOf("Nasi")).toHaveTextContent("0 porsiHARUS MASAK");
  });

  it("adds a bahan olahan from bahan baku only", async () => {
    api.addSemiItem.mockResolvedValue({ data: { success: true } });
    renderWithProviders(<StockManagement />, { preloadedState: asAdmin });

    await findRow("Susu Segar");
    fireEvent.click(screen.getByRole("button", { name: "Bahan Olahan" }));
    fireEvent.click(screen.getByRole("button", { name: "Tambah Bahan Olahan" }));
    const dialog = screen.getByRole("form", { name: "Form bahan olahan" });
    const ingredient = within(dialog).getByRole("combobox", { name: "Bahan 1" });
    expect(within(ingredient).queryByRole("option", { name: "Nasi" })).not.toBeInTheDocument();

    fireEvent.change(within(dialog).getByRole("textbox", { name: "Nama" }), { target: { value: "Sambal" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));
    expect(await screen.findByText("Pilih minimal satu bahan baku.")).toBeInTheDocument();
    expect(api.addSemiItem).not.toHaveBeenCalled();

    // Only the bahan baku: jumlah, harga and porsi are filled at Catat Masak.
    fireEvent.change(ingredient, { target: { value: "1" } });
    expect(within(dialog).queryByRole("textbox", { name: /Jumlah/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByPlaceholderText("Contoh: 150")).not.toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("Harga Bahan");
    expect(dialog).not.toHaveTextContent("Porsi");
    expect(dialog).not.toHaveTextContent("Satuan Stok");
    expect(dialog).not.toHaveTextContent("Stok sekarang");
    // A bahan already in the list is not offered again; an empty line is ignored.
    fireEvent.click(within(dialog).getByRole("button", { name: "+ Tambah Bahan Baku" }));
    const secondIngredient = within(dialog).getByRole("combobox", { name: "Bahan 2" });
    expect(within(secondIngredient).queryByRole("option", { name: "Susu Segar" })).not.toBeInTheDocument();
    expect(within(secondIngredient).getByRole("option", { name: "Bahan 03" })).toBeInTheDocument();

    // Sambal keeps for days: no daily write-off.
    expect(within(dialog).getByRole("radio", { name: /Dibuang tiap hari/ })).toBeChecked();
    fireEvent.click(within(dialog).getByRole("radio", { name: /Disimpan untuk besok/ }));
    expect(dialog).not.toHaveTextContent("Minimum Stok");
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));

    await waitFor(() =>
      expect(api.addSemiItem.mock.calls[0][0]).toEqual({
        name: "Sambal",
        minimumStock: 0,
        resetDaily: false,
        components: [{ stockItemId: 1 }],
      })
    );
    expect(await screen.findByText("Bahan olahan ditambahkan.")).toBeInTheDocument();
  });

  it("takes the bahan baku a Catat Masak is short of to Belanja Bahan", async () => {
    const onRestock = vi.fn();
    renderWithProviders(<StockManagement onRestock={onRestock} />, { preloadedState: asAdmin });

    await findRow("Susu Segar");
    fireEvent.click(screen.getByRole("button", { name: "Bahan Olahan" }));
    fireEvent.click(within(rowOf("Nasi")).getByRole("button", { name: "Catat Masak" }));
    const dialog = screen.getByRole("form", { name: "Form catat masak" });
    const bahan = within(dialog).getByRole("textbox", { name: "Jumlah Bahan 03" });

    // Enough stock: no button.
    expect(within(dialog).queryByRole("button", { name: "Belanja Bahan Kurang" })).not.toBeInTheDocument();
    fireEvent.change(bahan, { target: { value: "20" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Belanja Bahan Kurang" }));
    expect(onRestock).toHaveBeenCalledWith([{ stockItemId: 3, unit: "pcs" }]);
  });

  it("lets cashiers record a cooking with the portions counted", async () => {
    api.recordSemiProduction.mockResolvedValue({ data: { success: true } });
    renderWithProviders(<StockManagement />, { preloadedState: asCashier });

    await findRow("Susu Segar");
    fireEvent.click(screen.getByRole("button", { name: "Bahan Olahan" }));
    expect(screen.queryByRole("button", { name: "Tambah Bahan Olahan" })).not.toBeInTheDocument();
    expect(within(rowOf("Nasi")).queryByRole("button", { name: "Ubah" })).not.toBeInTheDocument();
    fireEvent.click(within(rowOf("Nasi")).getByRole("button", { name: "Catat Masak" }));

    const dialog = screen.getByRole("form", { name: "Form catat masak" });
    // The jumlah of each bahan starts from the latest cooking's. Only
    // portions are counted: no Takaran 1 Porsi.
    const bahan = within(dialog).getByRole("textbox", { name: "Jumlah Bahan 03" });
    expect(bahan).toHaveValue("1");
    expect(dialog).not.toHaveTextContent("Takaran");
    expect(dialog).not.toHaveTextContent("Berapa Kali Masak");

    fireEvent.change(bahan, { target: { value: "" } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Jumlah Porsi Jadi (porsi)" }), { target: { value: "20" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));
    expect(await screen.findByText("Isi jumlah bahan baku yang dipakai.")).toBeInTheDocument();

    fireEvent.change(bahan, { target: { value: "20" } });
    expect(dialog).toHaveTextContent("Stok sekarang: 10 pcs (stok kurang)");
    expect(within(dialog).getByRole("button", { name: "Simpan" })).toBeDisabled();

    // Portions are counted, never weighed.
    expect(within(dialog).queryByRole("button", { name: "Timbang Hasil" })).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/Berat Matang/)).not.toBeInTheDocument();

    // 5 pcs (Rp 5.000) for 20 portions.
    fireEvent.change(bahan, { target: { value: "5" } });
    expect(dialog).toHaveTextContent("Stok sekarang: 10 pcs");
    expect(dialog).not.toHaveTextContent("stok kurang");
    expect(dialog).toHaveTextContent("20 porsi");
    expect(dialog).toHaveTextContent("Rp 5.000");
    expect(dialog).toHaveTextContent("Rp 250");
    expect(dialog).toHaveTextContent("COGS per porsi");

    // Saving takes bahan baku out of stock, so it asks once more.
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));
    expect(dialog).toHaveTextContent("Stok bahan baku berkurang: Bahan 03 5 pcs. Stok Nasi bertambah 20 porsi.");
    expect(api.recordSemiProduction).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Kembali" }));
    expect(within(dialog).queryByRole("button", { name: "Ya, Simpan" })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));
    // Editing a field asks again.
    fireEvent.change(within(dialog).getByPlaceholderText("Opsional"), { target: { value: "x" } });
    expect(within(dialog).queryByRole("button", { name: "Ya, Simpan" })).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByPlaceholderText("Opsional"), { target: { value: "" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Ya, Simpan" }));

    await waitFor(() =>
      expect(api.recordSemiProduction.mock.calls[0][0]).toEqual({
        semiItemId: 20,
        items: [{ stockItemId: 3, quantity: 5 }],
        portionQuantity: 20,
        note: "",
        // The Daily Prep's business day: today unless picked.
        producedDate: getJakartaDateKey(),
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
    fireEvent.click(screen.getByRole("button", { name: "Bahan Olahan" }));
    fireEvent.click(within(rowOf("Nasi")).getByRole("button", { name: "Riwayat" }));

    const dialog = await screen.findByRole("dialog", { name: "Riwayat masak Nasi" });
    expect(await within(dialog).findByText("dibagi langsung")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("80 porsi");
    expect(dialog).not.toHaveTextContent("x masak");
    expect(dialog).toHaveTextContent("ditimbang 12.000 gr");
    expect(within(dialog).getAllByRole("button", { name: "Batalkan" })).toHaveLength(1);

    fireEvent.click(within(dialog).getByRole("button", { name: "Batalkan" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Ya, batalkan" }));
    await waitFor(() => expect(api.deleteSemiProduction.mock.calls[0][0]).toBe(8));
  });

  it("lets cashiers throw portions away with a bukti foto and shows the kerugian", async () => {
    api.recordSemiWaste.mockResolvedValue({ data: { success: true } });
    renderWithProviders(<StockManagement />, { preloadedState: asCashier });

    await findRow("Susu Segar");
    fireEvent.click(screen.getByRole("button", { name: "Bahan Olahan" }));
    fireEvent.click(within(rowOf("Nasi")).getByRole("button", { name: "Buang" }));

    const dialog = screen.getByRole("form", { name: "Form buang" });
    const quantity = within(dialog).getByPlaceholderText("Contoh: 5");
    fireEvent.change(quantity, { target: { value: "80" } });
    expect(dialog).toHaveTextContent("Lebih dari sisa stok (78 porsi)");
    expect(within(dialog).getByRole("button", { name: "Buang" })).toBeDisabled();

    // 5 of 78 portions worth Rp 68.250: Rp 4.375.
    fireEvent.change(quantity, { target: { value: "5" } });
    expect(dialog).toHaveTextContent("Rp 4.375");
    const reason = within(dialog).getByRole("combobox", { name: "Alasan" });
    expect(Array.from(reason.options, (option) => option.value)).toEqual(["Basi", "Jatuh", "Gosong", "Expired", "Lainnya"]);
    fireEvent.change(reason, { target: { value: "Jatuh" } });
    // Kasir must add a photo of what is thrown away.
    expect(dialog).toHaveTextContent("Foto bukti (wajib)");
    expect(within(dialog).getByRole("button", { name: "Buang" })).toBeDisabled();
    const camera = within(dialog).getByLabelText("Ambil foto bukti buang");
    expect(camera).toHaveAttribute("capture", "environment");
    fireEvent.change(camera, { target: { files: [photo("nasi-jatuh.jpg")] } });
    expect(await within(dialog).findByAltText("Bukti buang 1")).toHaveAttribute("src", "blob:nasi-jatuh.jpg");
    fireEvent.click(within(dialog).getByRole("button", { name: "Buang" }));

    await waitFor(() =>
      expect(api.recordSemiWaste.mock.calls[0][0]).toEqual({
        semiItemId: 20,
        quantity: 5,
        reason: "Jatuh",
        note: "",
        files: [expect.objectContaining({ name: "nasi-jatuh.jpg" })],
      })
    );
    expect(await screen.findByText("Kerugian dicatat.")).toBeInTheDocument();
  });

  it("lets admins throw bahan baku away, the photo optional", async () => {
    api.recordStockWaste.mockResolvedValue({ data: { success: true } });
    renderWithProviders(<StockManagement />, { preloadedState: asAdmin });

    fireEvent.click(within(await findRow("Susu Segar")).getByRole("button", { name: "Buang" }));
    const dialog = screen.getByRole("form", { name: "Form buang" });
    expect(dialog).toHaveTextContent("Buang Susu Segar");
    expect(dialog).toHaveTextContent("Sisa stok: 800 ml");
    expect(dialog).toHaveTextContent("Jumlah dibuang (ml)");
    expect(dialog).toHaveTextContent("Foto bukti (opsional)");

    // 100 of 800 ml worth Rp 20.488: Rp 2.561.
    fireEvent.change(within(dialog).getByPlaceholderText("Contoh: 5"), { target: { value: "100" } });
    expect(dialog).toHaveTextContent("Rp 2.561");
    fireEvent.change(within(dialog).getByRole("combobox", { name: "Alasan" }), { target: { value: "Expired" } });
    fireEvent.change(within(dialog).getByPlaceholderText("Opsional"), { target: { value: "lewat tanggal" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Buang" }));

    await waitFor(() =>
      expect(api.recordStockWaste.mock.calls[0][0]).toEqual({
        stockItemId: 1,
        quantity: 100,
        reason: "Expired",
        note: "lewat tanggal",
        files: [],
      })
    );
    expect(await screen.findByText("Kerugian dicatat.")).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Form buang" })).not.toBeInTheDocument();
  });

  it("tells COGS Sekarang (average of the stock) from the last cooking's cost", async () => {
    // Portions of an older, dearer cooking are still in stock.
    api.getSemiItems.mockResolvedValue({
      data: {
        data: [{ ...nasi, stock: 20, stockValue: 73183, averageCost: 3659, lastProduction: { ...nasi.lastProduction, unitCost: 3193 } }],
      },
    });
    renderWithProviders(<StockManagement />, { preloadedState: asAdmin });

    await findRow("Susu Segar");
    fireEvent.click(screen.getByRole("button", { name: "Bahan Olahan" }));
    const row = rowOf("Nasi");
    expect(row).toHaveTextContent("COGS Rp 3.193 / porsi");
    expect(row).toHaveTextContent("Rp 3.659 / porsiRata-rata stok, ada sisa masak sebelumnya");
  });

  it("lists the kerugian of bahan olahan per day and lets admins undo the latest write-off of an item", async () => {
    api.getStockWastes.mockResolvedValue({
      data: {
        data: {
          wastes: [
            semiWaste(12, { quantity: 70, cost: 61250, reason: "Sisa akhir hari", createdAt: "2026-10-28 22:00:00" }),
            semiWaste(11, { quantity: 8, cost: 7000, reason: "Penyesuaian", createdAt: "2026-10-28 15:00:00" }),
          ],
          dailyTotals: [{ date: "2026-10-28", cost: 68250, entries: 2 }],
        },
      },
    });
    api.deleteSemiWaste.mockResolvedValue({ data: { success: true } });
    renderWithProviders(<StockManagement />, { preloadedState: asAdmin });

    await findRow("Susu Segar");
    // A button inside the tab that shows a table on the page in place of the
    // list, not a dialog.
    fireEvent.click(screen.getByRole("button", { name: "Bahan Olahan" }));
    expect(screen.queryByRole("region", { name: "Riwayat kerugian" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Riwayat Kerugian" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Tambah Bahan Olahan")).not.toBeInTheDocument();

    const history = await screen.findByRole("region", { name: "Riwayat kerugian" });
    expect(await within(history).findByText("Sisa akhir hari")).toBeInTheDocument();
    // Only this tab's kind.
    expect(api.getStockWastes).toHaveBeenCalledWith({ kind: "semi" });
    expect(history).toHaveTextContent("Porsi bahan olahan yang dibuang");
    // A table: one row per write-off under its day, with the day's total.
    const table = within(history).getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Bahan",
      "Jumlah",
      "Alasan",
      "Dicatat",
      "Bukti",
      "Kerugian",
      "Aksi",
    ]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent))).toEqual([
      [expect.stringContaining("28 Okt 2026"), "Rp 68.250", ""],
      ["Nasi", "70 porsi", "Sisa akhir hari", expect.stringContaining("Admin"), "-", "Rp 61.250", "Batalkan"],
      ["Nasi", "8 porsi", "Penyesuaian", expect.stringContaining("Admin"), "-", "Rp 7.000", ""],
    ]);
    expect(within(history).getAllByRole("button", { name: "Batalkan" })).toHaveLength(1);

    fireEvent.click(within(history).getByRole("button", { name: "Batalkan" }));
    fireEvent.click(within(history).getByRole("button", { name: "Ya, kembalikan ke stok" }));
    await waitFor(() => expect(api.deleteSemiWaste.mock.calls[0][0]).toBe(12));

    // Kembali shows the Bahan Olahan list again.
    fireEvent.click(within(history).getByRole("button", { name: "Kembali" }));
    expect(screen.queryByRole("region", { name: "Riwayat kerugian" })).not.toBeInTheDocument();
    expect(rowOf("Nasi")).toHaveTextContent("Catat Masak");
  });

  it("has its own Riwayat Kerugian for bahan baku, with the bukti foto", async () => {
    api.getStockWastes.mockResolvedValue({
      data: {
        data: {
          wastes: [
            {
              id: 5, kind: "raw", itemId: 1, stockItemId: 1, itemName: "Susu Segar", wasteDate: "2026-10-28", quantity: 250, unit: "ml",
              cost: 6403, reason: "Basi", note: "kulkas mati", userName: "Kasir", createdAt: "2026-10-28 16:00:00",
              photos: [{ id: 4, url: "/api/stock-item/waste-photos/raw/4" }],
            },
          ],
          dailyTotals: [{ date: "2026-10-28", cost: 6403, entries: 1 }],
        },
      },
    });
    api.deleteStockWaste.mockResolvedValue({ data: { success: true } });
    renderWithProviders(<StockManagement />, { preloadedState: asAdmin });

    await findRow("Susu Segar");
    fireEvent.click(screen.getByRole("button", { name: "Riwayat Kerugian" }));
    const history = await screen.findByRole("region", { name: "Riwayat kerugian" });
    expect(await within(history).findByText("kulkas mati")).toBeInTheDocument();
    expect(api.getStockWastes).toHaveBeenCalledWith({ kind: "raw" });
    expect(history).toHaveTextContent("Bahan baku yang dibuang");
    // In place of the bahan baku list.
    expect(screen.queryByPlaceholderText("Search stock")).not.toBeInTheDocument();

    const row = within(history).getAllByRole("row")[2];
    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "Susu Segarkulkas mati", "250 ml", "Basi", expect.stringContaining("Kasir"), "", "Rp 6.403", "Batalkan",
    ]);
    // The bukti foto opens in full size.
    const photo = within(row).getByAltText("Bukti buang Susu Segar 1");
    expect(photo.getAttribute("src")).toMatch(/\/api\/stock-item\/waste-photos\/raw\/4$/);
    expect(photo.closest("a")).toHaveAttribute("target", "_blank");

    fireEvent.click(within(row).getByRole("button", { name: "Batalkan" }));
    fireEvent.click(within(history).getByRole("button", { name: "Ya, kembalikan ke stok" }));
    await waitFor(() => expect(api.deleteStockWaste.mock.calls[0][0]).toBe(5));
    expect(api.deleteSemiWaste).not.toHaveBeenCalled();

    fireEvent.click(within(history).getByRole("button", { name: "Kembali" }));
    expect(rowOf("Susu Segar")).toBeInTheDocument();
  });

  it("totals the kerugian of today, this week (from Monday) and this month", async () => {
    // Friday 30 Oct 2026: the week started on Monday the 26th.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-30T10:00:00+07:00"));
    api.getStockWastes.mockResolvedValue({
      data: {
        data: {
          wastes: [
            semiWaste(15, { wasteDate: "2026-10-30", quantity: 2, cost: 6180, reason: "Jatuh", createdAt: "2026-10-30 16:50:00" }),
          ],
          dailyTotals: [
            { date: "2026-10-30", cost: 6180, entries: 1 },
            { date: "2026-10-28", cost: 68250, entries: 2 },
            { date: "2026-10-25", cost: 5000, entries: 1 },
            { date: "2026-09-30", cost: 1000, entries: 1 },
          ],
        },
      },
    });

    try {
      renderWithProviders(<StockManagement />, { preloadedState: asCashier });
      await findRow("Susu Segar");
      fireEvent.click(screen.getByRole("button", { name: "Bahan Olahan" }));
      fireEvent.click(screen.getByRole("button", { name: "Riwayat Kerugian" }));

      const totals = await screen.findByRole("list", { name: "Total kerugian" });
      expect(within(totals).getAllByRole("listitem").map((card) => card.textContent)).toEqual([
        "Hari iniRp 6.180",
        "Minggu iniRp 74.430",
        "Bulan iniRp 79.430",
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("closes Riwayat Kerugian when another tab is chosen", async () => {
    renderWithProviders(<StockManagement />, { preloadedState: asAdmin });

    await findRow("Susu Segar");
    fireEvent.click(screen.getByRole("button", { name: "Bahan Olahan" }));
    fireEvent.click(screen.getByRole("button", { name: "Riwayat Kerugian" }));
    await screen.findByRole("region", { name: "Riwayat kerugian" });

    fireEvent.click(screen.getByRole("button", { name: "Bahan Baku" }));
    fireEvent.click(screen.getByRole("button", { name: "Bahan Olahan" }));
    expect(screen.queryByRole("region", { name: "Riwayat kerugian" })).not.toBeInTheDocument();
    expect(rowOf("Nasi")).toBeInTheDocument();
  });

  it("shows a recount above the stock as a selisih lebih that lowers the day's kerugian", async () => {
    api.getStockWastes.mockResolvedValue({
      data: {
        data: {
          wastes: [
            semiWaste(14, { wasteDate: "2026-10-30", quantity: -50, cost: -43750, reason: "Penyesuaian", createdAt: "2026-10-30 16:00:00" }),
            semiWaste(13, { wasteDate: "2026-10-30", quantity: 50, cost: 43750, reason: "Penyesuaian", createdAt: "2026-10-30 15:59:00" }),
          ],
          dailyTotals: [{ date: "2026-10-30", cost: 0, entries: 2 }],
        },
      },
    });
    renderWithProviders(<StockManagement />, { preloadedState: asAdmin });

    await findRow("Susu Segar");
    fireEvent.click(screen.getByRole("button", { name: "Bahan Olahan" }));
    fireEvent.click(screen.getByRole("button", { name: "Riwayat Kerugian" }));

    const history = await screen.findByRole("region", { name: "Riwayat kerugian" });
    expect(await within(history).findByText("lebih 50 porsi")).toBeInTheDocument();
    expect(within(history).getByText("-Rp 43.750")).toHaveClass("text-green-400");
    expect(within(history).getByText("50 porsi")).toBeInTheDocument();
  });

  it("says when no portion was thrown away", async () => {
    renderWithProviders(<StockManagement />, { preloadedState: asCashier });

    await findRow("Susu Segar");
    fireEvent.click(screen.getByRole("button", { name: "Bahan Olahan" }));
    fireEvent.click(screen.getByRole("button", { name: "Riwayat Kerugian" }));
    const empty = await screen.findByRole("region", { name: "Riwayat kerugian" });
    expect(await within(empty).findByText("Belum ada porsi yang dibuang.")).toBeInTheDocument();
    expect(within(empty).queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("shows the next 10 write-offs on the next page", async () => {
    api.getStockWastes.mockResolvedValue({
      data: {
        data: {
          wastes: Array.from({ length: 12 }, (_, index) =>
            semiWaste(100 - index, { quantity: index + 1, cost: 1000, reason: "Basi", userName: "Kasir" })
          ),
          dailyTotals: [{ date: "2026-10-28", cost: 12000, entries: 12 }],
        },
      },
    });
    renderWithProviders(<StockManagement />, { preloadedState: asCashier });

    await findRow("Susu Segar");
    fireEvent.click(screen.getByRole("button", { name: "Bahan Olahan" }));
    fireEvent.click(screen.getByRole("button", { name: "Riwayat Kerugian" }));
    const history = await screen.findByRole("region", { name: "Riwayat kerugian" });
    expect(await within(history).findByText("10 porsi")).toBeInTheDocument();
    expect(history).toHaveTextContent("Showing 1 - 10 of 12");
    expect(within(history).queryByText("11 porsi")).not.toBeInTheDocument();
    // Kasir see the kerugian but cannot undo it.
    expect(within(history).queryByRole("button", { name: "Batalkan" })).not.toBeInTheDocument();

    fireEvent.click(within(history).getByRole("button", { name: "Next" }));
    expect(history).toHaveTextContent("Showing 11 - 12 of 12");
    expect(within(history).getByText("12 porsi")).toBeInTheDocument();
    // The day's total stays the whole day's on every page.
    expect(history).toHaveTextContent("Rp 12.000");
  });
});
