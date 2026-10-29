import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import Dashboard from "../../src/features/dashboard/pages/DashboardPage";
import { periodRange } from "../../src/features/inventory/utils/periods";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  getOrders: vi.fn(),
  getPaymentSources: vi.fn(),
  getPurchaseDrafts: vi.fn(),
  getPurchaseNotas: vi.fn(),
  getPurchases: vi.fn(),
  getSemiItems: vi.fn(),
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
    .filter((name) => ["Metrik", "Pesanan", "Stok", "Belanja", "Menu", "Rekap", "Pengaturan"].includes(name));

describe("dashboard menus: Stok holds what is on hand, Belanja the purchases", () => {
  beforeEach(() => {
    api.getOrders.mockResolvedValue({ data: { data: [] } });
    api.getStockItems.mockResolvedValue({ data: { data: [] } });
    api.getSemiItems.mockResolvedValue({ data: { data: [] } });
    api.getSupplyItems.mockResolvedValue({ data: { data: [] } });
    api.getPurchases.mockResolvedValue({ data: { data: { purchases: [], itemGroups: [], total: 0 } } });
    api.getPurchaseNotas.mockResolvedValue({ data: { data: { notas: [], total: 0, page: 1 } } });
    api.getSupplyPurchaseNotas.mockResolvedValue({ data: { data: { notas: [], total: 0, page: 1 } } });
    api.getShoppingSuppliers.mockResolvedValue({ data: { data: [] } });
    api.getPaymentSources.mockResolvedValue({ data: { data: [] } });
    api.getPurchaseDrafts.mockResolvedValue({ data: { data: [draft(5, "raw")] } });
    api.getSupplyPurchaseDrafts.mockResolvedValue({ data: { data: [draft(6, "supply")] } });
  });

  it("puts Belanja right after Stok with the number of draft nota", async () => {
    renderWithProviders(<Dashboard />, { preloadedState: user("Admin") });
    expect(menuNames()).toEqual(["Metrik", "Pesanan", "Stok", "Belanja", "Menu", "Rekap", "Pengaturan"]);
    expect(await screen.findByRole("button", { name: "Belanja 2" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Belanja 2" }));
    expect(screen.getByRole("heading", { name: "Belanja" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tambah Belanja" })).toBeInTheDocument();
    expect(await screen.findByText("Draft Nota Menunggu Posting (2)")).toBeInTheDocument();
    // The history opens Per Nota.
    expect(await screen.findByText("Belum ada belanja bahan baku tersimpan.")).toBeInTheDocument();
    expect(api.getPurchaseNotas).toHaveBeenCalledWith({ search: "", page: 1, ...periodRange("month") });
  });

  it("counts the bahan baku to restock on the Stok menu", async () => {
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
    expect(await screen.findByRole("button", { name: "Stok 2" })).toBeInTheDocument();
  });

  it("keeps only bahan baku, bahan setengah jadi and lainnya under Stok", async () => {
    renderWithProviders(<Dashboard />, { preloadedState: user("Admin") });
    fireEvent.click(screen.getByRole("button", { name: /^Stok/ }));

    const page = screen.getByRole("heading", { name: "Stok Management" }).closest("div.container");
    for (const tab of ["Bahan Baku", "Bahan Setengah Jadi", "Lainnya"]) {
      expect(within(page).getByRole("button", { name: tab })).toBeInTheDocument();
    }
    expect(within(page).queryByRole("button", { name: "Bahan Belanjaan" })).not.toBeInTheDocument();
    expect(within(page).queryByRole("button", { name: "Tambah Belanja" })).not.toBeInTheDocument();
  });

  it("shows Belanja to kasir, who write draft nota", async () => {
    renderWithProviders(<Dashboard />, { preloadedState: user("Cashier") });
    expect(menuNames()).toEqual(["Metrik", "Pesanan", "Stok", "Belanja", "Rekap"]);
    fireEvent.click(await screen.findByRole("button", { name: "Belanja 2" }));
    expect(screen.getByRole("button", { name: "Tambah Belanja" })).toBeInTheDocument();
  });
});
