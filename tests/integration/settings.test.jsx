import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import $ from "jquery";
import * as api from "../../src/https/index";
import { SettingsManagement } from "../../src/features/settings";
import { getJakartaDateKey } from "../../src/shared/lib/dates";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  addPaymentSource: vi.fn(),
  addPaymentSourceMutation: vi.fn(),
  deleteSupplier: vi.fn(),
  getCategories: vi.fn(),
  getOrderPlatforms: vi.fn(),
  getPaymentSourceMutations: vi.fn(),
  getPaymentSources: vi.fn(),
  getShoppingSuppliers: vi.fn(),
  updateCategoryBestSellerGroups: vi.fn(),
  updatePaymentSource: vi.fn(),
}));

const sources = [
  { id: 1, name: "Kasir (Tunai)", balance: 85000, isActive: true, sortOrder: 1 },
  { id: 2, name: "Rekening Penjualan", balance: 0, isActive: false, sortOrder: 2 },
  { id: 3, name: "Niskala", balance: -7000, isActive: true, sortOrder: 3 },
];

const openPaymentSources = async () => {
  renderWithProviders(<SettingsManagement />);
  fireEvent.click(screen.getByRole("button", { name: "Sumber Pembayaran" }));
  return (await screen.findByText("Kasir (Tunai)")).closest("table");
};

describe("settings: sumber pembayaran", () => {
  beforeEach(() => {
    api.getOrderPlatforms.mockResolvedValue({ data: { data: [] } });
    api.getShoppingSuppliers.mockResolvedValue({ data: { data: [] } });
    api.getPaymentSources.mockResolvedValue({ data: { data: sources } });
  });

  it("lists every source with its saldo and the total of active ones", async () => {
    const table = await openPaymentSources();
    expect(api.getPaymentSources).toHaveBeenCalledWith({ includeInactive: true });
    const niskala = within(table).getByText("Niskala").closest("tr");
    expect(within(niskala).getByText("-Rp 7.000")).toHaveClass("text-red-400");
    expect(within(table).getByText("Rekening Penjualan").closest("tr")).toHaveTextContent("Nonaktif");
    expect(screen.getByText(/Total saldo aktif/)).toHaveTextContent("Total saldo aktif: Rp 78.000");
  });

  it("records saldo keluar with a note", async () => {
    api.addPaymentSourceMutation.mockResolvedValue({ data: { data: { balance: 35000 } } });
    await openPaymentSources();
    fireEvent.click(screen.getByRole("button", { name: "Catat saldo Kasir (Tunai)" }));
    const dialog = screen.getByRole("dialog", { name: "Catat Saldo Kasir (Tunai)" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Saldo Keluar" }));
    fireEvent.change(within(dialog).getByLabelText("Nominal"), { target: { value: "Rp 50.000" } });
    expect(within(dialog).getByLabelText("Nominal")).toHaveValue("50.000");
    expect(dialog).toHaveTextContent("Saldo setelah dicatat: Rp 35.000");
    fireEvent.change(within(dialog).getByLabelText("Keterangan (opsional)"), { target: { value: " Ambil untuk ongkir " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));

    await waitFor(() =>
      expect(api.addPaymentSourceMutation.mock.calls[0][0]).toEqual({
        id: 1,
        type: "out",
        amount: 50000,
        date: getJakartaDateKey(),
        note: "Ambil untuk ongkir",
      })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("does not record an empty amount", async () => {
    await openPaymentSources();
    fireEvent.click(screen.getByRole("button", { name: "Catat saldo Niskala" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Simpan" }));
    expect(await screen.findByText("Isi nominal lebih dari 0.")).toBeInTheDocument();
    expect(api.addPaymentSourceMutation).not.toHaveBeenCalled();
  });

  it("shows the saldo history with saldo masuk, keluar and akhir", async () => {
    api.getPaymentSourceMutations.mockResolvedValue({
      data: {
        data: {
          source: sources[0],
          mutations: [
            { id: 2, date: "2026-10-02", amountIn: 0, amountOut: 15000, balanceAfter: 85000, referenceType: "purchase", note: "Belanja #14 - Toko Beras", userName: "Admin" },
            { id: 1, date: "2026-10-01", amountIn: 100000, amountOut: 0, balanceAfter: 100000, referenceType: "manual", note: "Modal awal", userName: "Admin" },
          ],
          total: 2,
          totalIn: 100000,
          totalOut: 15000,
          page: 1,
          pageSize: 20,
        },
      },
    });
    await openPaymentSources();
    fireEvent.click(screen.getByRole("button", { name: "Riwayat saldo Kasir (Tunai)" }));
    const dialog = screen.getByRole("dialog", { name: "Riwayat Saldo Kasir (Tunai)" });

    const purchaseRow = (await within(dialog).findByText("Belanja #14 - Toko Beras")).closest("tr");
    expect(purchaseRow).toHaveTextContent("2 Oktober 2026");
    expect(purchaseRow).toHaveTextContent("Belanja");
    expect(purchaseRow).toHaveTextContent("Rp 15.000");
    expect(purchaseRow).toHaveTextContent("Rp 85.000");
    expect(within(dialog).getByText("Modal awal").closest("tr")).toHaveTextContent("Catat manual");
    expect(dialog).toHaveTextContent("Total Saldo MasukRp 100.000");
    expect(dialog).toHaveTextContent("Total Saldo KeluarRp 15.000");
    expect(api.getPaymentSourceMutations).toHaveBeenCalledWith({ id: 1, page: 1 });
  });

  it("adds and renames sources", async () => {
    api.addPaymentSource.mockResolvedValue({ data: { data: { id: 4 } } });
    api.updatePaymentSource.mockResolvedValue({ data: { data: { id: 3 } } });
    await openPaymentSources();

    fireEvent.change(screen.getByLabelText("Nama Sumber"), { target: { value: "  Kas   Kecil " } });
    fireEvent.click(screen.getByRole("button", { name: "Tambah" }));
    await waitFor(() => expect(api.addPaymentSource.mock.calls[0][0]).toEqual({ name: "Kas Kecil", isActive: true }));

    fireEvent.click(screen.getByRole("button", { name: "Ubah Niskala" }));
    expect(screen.getByLabelText("Nama Sumber")).toHaveValue("Niskala");
    fireEvent.click(screen.getByLabelText("Aktif (bisa dipilih di form belanja)"));
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    await waitFor(() =>
      expect(api.updatePaymentSource.mock.calls[0][0]).toEqual({ id: 3, name: "Niskala", isActive: false })
    );
  });
});

describe("settings: suplier", () => {
  beforeEach(() => {
    api.getOrderPlatforms.mockResolvedValue({ data: { data: [] } });
    api.getShoppingSuppliers.mockResolvedValue({
      data: { data: [{ id: 1, name: "Shopee" }, { id: 2, name: "vendor" }] },
    });
  });

  it("deletes a suplier after asking, and shows why one used by a nota stays", async () => {
    api.deleteSupplier
      .mockResolvedValueOnce({ data: { message: "Suplier vendor dihapus." } })
      .mockRejectedValueOnce({
        response: { data: { message: "Shopee dipakai di 22 nota belanja, jadi tidak bisa dihapus. Ganti namanya lewat Ubah." } },
      });
    renderWithProviders(<SettingsManagement />);
    fireEvent.click(screen.getByRole("button", { name: "Suplier" }));

    fireEvent.click(await screen.findByRole("button", { name: "Hapus suplier vendor" }));
    let dialog = screen.getByRole("dialog", { name: "Hapus suplier" });
    expect(dialog).toHaveTextContent("Suplier vendor akan dihapus.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Batal" }));
    expect(screen.queryByRole("dialog", { name: "Hapus suplier" })).not.toBeInTheDocument();
    expect(api.deleteSupplier).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Hapus suplier vendor" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Hapus suplier" })).getByRole("button", { name: "Hapus" }));
    await waitFor(() => expect(api.deleteSupplier).toHaveBeenCalledWith(2));
    expect(await screen.findByText("Suplier vendor dihapus.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hapus suplier Shopee" }));
    dialog = screen.getByRole("dialog", { name: "Hapus suplier" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Hapus" }));
    expect(
      await screen.findByText("Shopee dipakai di 22 nota belanja, jadi tidak bisa dihapus. Ganti namanya lewat Ubah.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Hapus suplier" })).not.toBeInTheDocument();
  });
});

describe("settings: best seller", () => {
  beforeEach(() => {
    api.getOrderPlatforms.mockResolvedValue({ data: { data: [] } });
    api.getCategories.mockResolvedValue({
      data: {
        data: [
          { id: 1, name: "Black Coffee", isActive: true, bestSellerGroup: "Minuman" },
          { id: 2, name: "Rice Bowl", isActive: true, bestSellerGroup: "Makanan" },
          { id: 3, name: "Roti", isActive: false, bestSellerGroup: "Snack" },
          { id: 4, name: "Catering", isActive: true, bestSellerGroup: null },
        ],
      },
    });
    api.updateCategoryBestSellerGroups.mockResolvedValue({ data: { success: true } });
  });

  // The categories listed in each column.
  const columnsShown = () =>
    Object.fromEntries(
      ["Makanan", "Minuman", "Snack", "Dikecualikan"].map((column) => [
        column,
        within(screen.getByRole("list", { name: `Kategori ${column}` }))
          .queryAllByRole("button")
          .map((button) => button.getAttribute("aria-label")),
      ])
    );
  const names = (column) =>
    within(screen.getByRole("list", { name: `Kategori ${column}` })).queryAllByRole("listitem").map((item) => item.textContent);
  const addTo = (column, id, text) =>
    $(screen.getByLabelText(`Tambah kategori ke ${column}`))
      .val(String(id))
      .trigger($.Event("select2:select", { params: { data: { id: String(id), text } } }));
  const openBestSeller = async () => {
    renderWithProviders(<SettingsManagement />);
    fireEvent.click(screen.getByRole("button", { name: "Best Seller" }));
    await screen.findByRole("region", { name: "Kolom Makanan" });
  };

  it("shows a column per Best Seller tab and Dikecualikan, each with its categories", async () => {
    await openBestSeller();
    expect(api.getCategories).toHaveBeenCalledWith({ includeInactive: true });
    expect(["Makanan", "Minuman", "Snack", "Dikecualikan"].map(names)).toEqual([
      ["Rice Bowl×"],
      ["Black Coffee×"],
      ["RotiNonaktif×"],
      ["Catering"],
    ]);
    expect(columnsShown()["Dikecualikan"]).toEqual([]);
    // A column's picker offers the categories of the other columns, by column.
    const picker = screen.getByLabelText("Tambah kategori ke Makanan");
    await waitFor(() =>
      expect(Array.from(picker.querySelectorAll("optgroup"), (group) => [group.label, Array.from(group.children, (option) => option.text)])).toEqual([
        ["Minuman", ["Black Coffee"]],
        ["Snack", ["Roti"]],
        ["Dikecualikan", ["Catering"]],
      ])
    );
    expect(screen.getByRole("button", { name: "Simpan" })).toBeDisabled();
  });

  it("moves categories between columns and saves them all at once", async () => {
    await openBestSeller();
    addTo("Makanan", 3, "Roti");
    await waitFor(() => expect(names("Makanan")).toEqual(["Rice Bowl×", "RotiNonaktif×"]));
    expect(names("Snack")).toEqual(["Belum ada kategori"]);
    fireEvent.click(screen.getByRole("button", { name: "Keluarkan Black Coffee dari Minuman" }));
    expect(names("Dikecualikan")).toEqual(["Black Coffee", "Catering"]);
    addTo("Snack", 4, "Catering");
    await waitFor(() => expect(names("Snack")).toEqual(["Catering×"]));

    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    await waitFor(() =>
      expect(api.updateCategoryBestSellerGroups.mock.calls[0][0]).toEqual({ Makanan: [2, 3], Minuman: [], Snack: [4] })
    );
  });

  it("drops unsaved changes with Batal", async () => {
    await openBestSeller();
    fireEvent.click(screen.getByRole("button", { name: "Keluarkan Roti dari Snack" }));
    expect(names("Snack")).toEqual(["Belum ada kategori"]);
    fireEvent.click(screen.getByRole("button", { name: "Batal" }));
    expect(names("Snack")).toEqual(["RotiNonaktif×"]);
    expect(screen.getByRole("button", { name: "Simpan" })).toBeDisabled();
  });
});
