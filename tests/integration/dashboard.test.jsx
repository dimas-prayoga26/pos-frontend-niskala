import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import $ from "jquery";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import Dashboard from "../../src/features/dashboard/pages/DashboardPage";
import { periodRange } from "../../src/features/inventory/utils/periods";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  getCategories: vi.fn(),
  getMenuItems: vi.fn(),
  getOrders: vi.fn(),
  getPaymentSources: vi.fn(),
  getPurchaseDrafts: vi.fn(),
  getPurchaseNotas: vi.fn(),
  getPurchases: vi.fn(),
  getSemiItems: vi.fn(),
  getShoppingSummary: vi.fn(),
  getMerks: vi.fn(() => Promise.resolve({ data: { data: [] } })),
  getShoppingSuppliers: vi.fn(),
  getStockItems: vi.fn(),
  getSupplyItems: vi.fn(),
  getSupplyPurchaseDrafts: vi.fn(),
  getSupplyPurchaseNotas: vi.fn(),
}));
// The Metrik tab opens first; its charts are not what this test is about.
vi.mock("../../src/components/dashboard/Metrics", () => ({ default: () => <p>Metrik</p> }));

const user = (role) => ({ user: { _id: 1, name: role, email: "u", phone: "1", role, isAuth: true } });
const draft = (id, kind) => ({
  id,
  kind,
  date: "2026-10-30",
  suplierId: 1,
  supplierName: "Pasar Uji",
  paymentSourceId: 1,
  total: 10000,
  createdBy: "Kasir",
  createdAt: "2026-10-30 08:00:00",
  items: [{ id: id * 10, itemName: "Gula", quantity: 1, unit: "kg", unitPrice: 10000, total: 10000 }],
  attachments: [],
});
const menuNames = () =>
  screen
    .getAllByRole("button")
    .map((button) => button.textContent.replace(/\d+$/, ""))
    .filter((name) => ["Metrik", "Pesanan", "Stok Bahan", "Belanja", "Menu", "Rekap", "Pengaturan"].includes(name));

describe("dashboard menus: Stok Bahan holds what is on hand, Belanja the purchases", () => {
  beforeEach(() => {
    api.getOrders.mockResolvedValue({ data: { data: [] } });
    api.getStockItems.mockResolvedValue({ data: { data: [] } });
    api.getSemiItems.mockResolvedValue({ data: { data: [] } });
    api.getSupplyItems.mockResolvedValue({ data: { data: [] } });
    api.getPurchases.mockResolvedValue({ data: { data: { purchases: [], itemGroups: [], total: 0 } } });
    api.getPurchaseNotas.mockResolvedValue({ data: { data: { notas: [], total: 0, page: 1 } } });
    api.getSupplyPurchaseNotas.mockResolvedValue({ data: { data: { notas: [], total: 0, page: 1 } } });
    api.getShoppingSuppliers.mockResolvedValue({ data: { data: [] } });
    api.getShoppingSummary.mockResolvedValue({ data: { data: null } });
    api.getPaymentSources.mockResolvedValue({ data: { data: [] } });
    api.getPurchaseDrafts.mockResolvedValue({ data: { data: [draft(5, "raw")] } });
    api.getSupplyPurchaseDrafts.mockResolvedValue({ data: { data: [draft(6, "supply")] } });
  });

  it("puts Belanja right after Stok Bahan with the number of draft nota", async () => {
    renderWithProviders(<Dashboard />, { preloadedState: user("Admin") });
    expect(menuNames()).toEqual(["Metrik", "Pesanan", "Stok Bahan", "Belanja", "Menu", "Rekap", "Pengaturan"]);
    expect(await screen.findByRole("button", { name: "Belanja 2" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Belanja 2" }));
    expect(screen.getByRole("heading", { name: "Belanja" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tambah Belanja" })).toBeInTheDocument();
    expect(await screen.findByText("Draft Nota Menunggu Posting (2)")).toBeInTheDocument();
    // The history opens Per Nota.
    expect(await screen.findByText("Belum ada belanja bahan baku tersimpan.")).toBeInTheDocument();
    expect(api.getPurchaseNotas).toHaveBeenCalledWith({ search: "", page: 1, ...periodRange("month") });
  });

  it("counts the bahan baku to restock on the Stok Bahan menu", async () => {
    api.getStockItems.mockResolvedValue({
      data: {
        data: ["HAMPIR HABIS", "HARUS ORDER", "AMAN", "AMAN", "BEBAS STOK"].map((status, index) => ({
          id: index + 1,
          name: `Bahan ${index + 1}`,
          unit: "pcs",
          stock: 1,
          minimumStock: 0,
          status,
        })),
      },
    });
    renderWithProviders(<Dashboard />, { preloadedState: user("Admin") });
    expect(await screen.findByRole("button", { name: "Stok Bahan 2" })).toBeInTheDocument();
  });

  it("keeps only bahan baku and bahan olahan under Stok Bahan", async () => {
    renderWithProviders(<Dashboard />, { preloadedState: user("Admin") });
    fireEvent.click(screen.getByRole("button", { name: /^Stok Bahan/ }));

    const page = screen.getByRole("heading", { name: "Stok Management" }).closest("div.container");
    for (const tab of ["Bahan Baku", "Bahan Olahan"]) {
      expect(within(page).getByRole("button", { name: tab })).toBeInTheDocument();
    }
    // Barang Lainnya are seen in the Belanja menu.
    expect(within(page).queryByRole("button", { name: "Lainnya" })).not.toBeInTheDocument();
    expect(within(page).queryByRole("button", { name: "Bahan Belanjaan" })).not.toBeInTheDocument();
    expect(within(page).queryByRole("button", { name: "Tambah Belanja" })).not.toBeInTheDocument();
  });

  it("goes from a Catat Masak short of bahan baku to Tambah Belanja with them picked", async () => {
    const beras = { id: 3, name: "Beras", unit: "gr", stock: 0, averageCost: 13, isRecipeIngredient: true, status: "HARUS ORDER" };
    api.getStockItems.mockResolvedValue({ data: { data: [beras] } });
    api.getSemiItems.mockResolvedValue({
      data: {
        data: [
          {
            id: 20,
            name: "Nasi",
            unit: "porsi",
            stock: 0,
            components: [{ stockItemId: 3, name: "Beras", unit: "gr", quantity: 500, unitCost: 13, cost: 6500 }],
          },
        ],
      },
    });
    renderWithProviders(<Dashboard />, { preloadedState: user("Admin") });
    fireEvent.click(screen.getByRole("button", { name: /^Stok Bahan/ }));
    fireEvent.click(screen.getByRole("button", { name: "Bahan Olahan" }));
    fireEvent.click(await screen.findByRole("button", { name: "Catat Masak" }));
    fireEvent.click(screen.getByRole("button", { name: "Belanja Bahan Kurang" }));

    expect(screen.getByRole("heading", { name: "Belanja" })).toBeInTheDocument();
    const form = screen.getByRole("dialog");
    expect(form).toHaveTextContent("Tambah Belanja");
    expect(form.querySelector('select[aria-label="Cari atau buat barang"]')).toHaveValue("3");

    // Opening Belanja from its menu starts without them.
    fireEvent.click(screen.getByRole("button", { name: /^Stok Bahan/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Belanja/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("goes from a recipe bahan the menu form does not find to its Tambah form at Stok Bahan, and stays there on Batal", async () => {
    api.getCategories.mockResolvedValue({ data: { data: [{ id: 1, name: "Kopi", isActive: true }] } });
    api.getMenuItems.mockResolvedValue({ data: { data: [] } });
    api.getStockItems.mockResolvedValue({
      data: { data: [{ id: 1, name: "Susu Segar", unit: "ml", stock: 10, isRecipeIngredient: true, status: "AMAN" }] },
    });
    api.getSemiItems.mockResolvedValue({ data: { data: [{ id: 5, name: "Nasi", unit: "porsi", stock: 0 }] } });
    renderWithProviders(<Dashboard />, { preloadedState: user("Admin") });
    const openRecipeSearch = async (kind, term) => {
      fireEvent.click(screen.getByRole("button", { name: "Menu" }));
      fireEvent.click(await screen.findByRole("button", { name: "Menu Items" }));
      fireEvent.click(await screen.findByRole("button", { name: "Tambah Menu" }));
      fireEvent.click(within(screen.getByText("Komposisi Bahan").parentElement).getByRole("button", { name: "Tambah" }));
      fireEvent.click(within(screen.getByRole("group", { name: "Jenis bahan" })).getByRole("button", { name: kind }));
      const picker = screen.getByLabelText("Stok bahan");
      await waitFor(() => expect(picker.options.length).toBeGreaterThan(1));
      act(() => {
        $(picker).select2("open");
        $(document.querySelector(".select2-search__field")).val(term).trigger("input");
      });
      fireEvent.click(await screen.findByRole("button", { name: `Buat ${kind}` }));
    };

    // Bahan baku: Stok Bahan → Bahan Baku with Tambah Bahan; the menu form is left.
    await openRecipeSearch("Bahan Baku", "Kemiri");
    const form = await screen.findByRole("form", { name: "Form tambah bahan" });
    expect(within(form).getByPlaceholderText("Contoh: Cabe Rawit")).toHaveValue("Kemiri");
    expect(screen.queryByText("Komposisi Bahan")).not.toBeInTheDocument();
    fireEvent.click(within(form).getByRole("button", { name: "Batal" }));
    expect(screen.queryByRole("form", { name: "Form tambah bahan" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bahan Baku" })).toBeInTheDocument();
    expect(screen.queryByText("Komposisi Bahan")).not.toBeInTheDocument();

    // Bahan olahan: Stok Bahan → Bahan Olahan with Tambah Bahan Olahan.
    await openRecipeSearch("Bahan Olahan", "Sambal");
    const semiForm = await screen.findByRole("form", { name: "Form bahan olahan" });
    expect(within(semiForm).getByRole("textbox", { name: "Nama" })).toHaveValue("Sambal");
    fireEvent.click(within(semiForm).getByRole("button", { name: "Batal" }));
    expect(screen.queryByRole("form", { name: "Form bahan olahan" })).not.toBeInTheDocument();
    expect(screen.queryByText("Komposisi Bahan")).not.toBeInTheDocument();

    // Opening Stok Bahan from its menu starts without a form.
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: /^Stok Bahan/ }));
    expect(screen.queryByRole("form", { name: "Form tambah bahan" })).not.toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Form bahan olahan" })).not.toBeInTheDocument();
  });

  it("shows Belanja to kasir, who write draft nota", async () => {
    renderWithProviders(<Dashboard />, { preloadedState: user("Cashier") });
    expect(menuNames()).toEqual(["Metrik", "Pesanan", "Stok Bahan", "Belanja", "Rekap"]);
    fireEvent.click(await screen.findByRole("button", { name: "Belanja 2" }));
    expect(screen.getByRole("button", { name: "Tambah Belanja" })).toBeInTheDocument();
  });
});
