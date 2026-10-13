import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import ShoppingManagement from "../../src/features/inventory/components/ShoppingManagement";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  deletePurchaseItem: vi.fn(),
  getPurchases: vi.fn(),
  getShoppingSuppliers: vi.fn(),
  savePurchase: vi.fn(),
  updatePurchaseItem: vi.fn(),
}));

const history = (id, overrides = {}) => ({
  id,
  purchaseId: 7,
  itemName: "Gula",
  purchaseDate: "2026-09-15",
  supplierName: "Pasar Uji",
  paymentMethod: "Cash",
  quantity: 2000,
  unit: "gr",
  unitPrice: 15,
  total: 30000,
  stockQuantity: 2000,
  stockUnit: "gr",
  stockAverageCost: 15,
  stockValueAfter: 30000,
  ...overrides,
});

const itemGroups = [
  {
    stockItemId: 5,
    itemName: "Gula",
    stock: 2500,
    stockUnit: "gr",
    averageCost: 14.5,
    stockValue: 36250,
    purchaseCount: 2,
    histories: [history(91), history(90, { purchaseDate: "2026-09-01", quantity: 500, total: 7500 })],
    logs: [
      { id: 1, action: "create", userName: "Admin Uji", createdAt: "2026-09-15T03:00:00Z", newData: { quantity: 2000, unit: "gr", unitPrice: 15 } },
      { id: 2, action: "edit", userName: "Admin Uji", createdAt: "2026-09-16T03:00:00Z", oldData: { quantity: 400, unit: "gr", unitPrice: 20 }, newData: { quantity: 500, unit: "gr", unitPrice: 15 } },
    ],
  },
];
const stockItems = [{ id: 5, name: "Gula", unit: "gr" }];

const renderShopping = (isAdmin = true) =>
  renderWithProviders(<ShoppingManagement stockItems={stockItems} isAdmin={isAdmin} />);

describe("shopping history", () => {
  beforeEach(() => {
    api.getShoppingSuppliers.mockResolvedValue({ data: { data: [{ id: 1, name: "Pasar Uji" }] } });
    api.getPurchases.mockResolvedValue({ data: { data: { purchases: [], itemGroups, groupTotal: 12, total: 2 } } });
  });

  it("lists the latest purchase per item with formatted figures and pagination", async () => {
    renderShopping();

    const row = (await screen.findByText("Gula")).closest("tr");
    expect(row).toHaveTextContent("2 history");
    expect(row).toHaveTextContent("#7 - Cash");
    expect(row).toHaveTextContent("2.000 gr");
    expect(row).toHaveTextContent("Rp 30.000");
    expect(row).toHaveTextContent("Rp 15 / gr");
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(api.getPurchases).toHaveBeenLastCalledWith({ search: "", page: 1 });

    fireEvent.click(screen.getByRole("button", { name: "Berikutnya" }));
    await waitFor(() => expect(api.getPurchases).toHaveBeenLastCalledWith({ search: "", page: 2 }));

    fireEvent.change(screen.getByLabelText("Cari riwayat belanja"), { target: { value: "gul" } });
    await waitFor(() => expect(api.getPurchases).toHaveBeenLastCalledWith({ search: "gul", page: 1 }));
  });

  it("shows item detail with history, activity log and admin actions", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    api.deletePurchaseItem.mockResolvedValue({ data: { success: true } });
    renderShopping();

    fireEvent.click((await screen.findByText("Gula")).closest("tr"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("2 history pembelian")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Rp 36.250");
    expect(dialog).toHaveTextContent("Rp 15 / gr");

    fireEvent.click(within(dialog).getAllByRole("button", { name: "Delete" })[1]);
    expect(window.confirm).toHaveBeenCalledWith("Hapus belanja Gula ini?");
    await waitFor(() => expect(api.deletePurchaseItem.mock.calls[0][0]).toBe(90));

    fireEvent.click(within(dialog).getByRole("button", { name: "Log Aktivitas" }));
    expect(dialog).toHaveTextContent("2.000 gr ditambahkan, harga Rp 15");
    expect(dialog).toHaveTextContent("400 gr -> 500 gr, Rp 20 -> Rp 15");
  });

  it("edits a purchase item from the total price", async () => {
    api.updatePurchaseItem.mockResolvedValue({ data: { success: true } });
    renderShopping();

    fireEvent.click((await screen.findByText("Gula")).closest("tr"));
    fireEvent.click(within(screen.getByRole("dialog")).getAllByRole("button", { name: "Update" })[0]);

    const editForm = screen.getByText(/^Edit Belanja/).closest("form");
    const quantityInput = within(editForm).getByLabelText("Gramasi");
    const totalInput = within(editForm).getByLabelText("Harga Total");
    expect(totalInput).toHaveValue("30.000");
    fireEvent.change(quantityInput, { target: { value: "2,5" } });
    fireEvent.change(totalInput, { target: { value: "Rp 40.000" } });
    fireEvent.click(within(editForm).getByRole("button", { name: "Simpan" }));

    await waitFor(() =>
      expect(api.updatePurchaseItem.mock.calls[0][0]).toEqual({ id: 91, quantity: 2.5, unit: "gr", unitPrice: 16000 })
    );
  });

  it("hides admin actions for cashiers and validates an empty purchase form", async () => {
    const { unmount } = renderShopping(false);
    fireEvent.click((await screen.findByText("Gula")).closest("tr"));
    expect(screen.queryByRole("button", { name: "Update" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tambah Bahan Belanjaan" })).not.toBeInTheDocument();
    unmount();

    renderShopping(true);
    fireEvent.click(await screen.findByRole("button", { name: "Tambah Bahan Belanjaan" }));
    const form = screen.getByRole("dialog");
    fireEvent.change(within(form).getByLabelText("Catatan (opsional)"), { target: { value: "draft note" } });
    fireEvent.change(within(form).getByLabelText("Gramasi"), { target: { value: "1/2" } });
    fireEvent.change(within(form).getByLabelText("Harga Total"), { target: { value: "15000" } });
    expect(form).toHaveTextContent("Total: Rp 15.000");
    // Required inputs are filled; supplier and item are still missing.
    fireEvent.click(screen.getByRole("button", { name: "Simpan Belanjaan" }));
    expect(await screen.findByText("Lengkapi toko, barang, gramasi, satuan, dan harga total.")).toBeInTheDocument();
    expect(api.savePurchase).not.toHaveBeenCalled();

    // The draft survives closing and reopening the form.
    fireEvent.click(screen.getByRole("button", { name: "Tutup form" }));
    fireEvent.click(screen.getByRole("button", { name: "Tambah Bahan Belanjaan" }));
    expect(screen.getByDisplayValue("draft note")).toBeInTheDocument();
  });
});
