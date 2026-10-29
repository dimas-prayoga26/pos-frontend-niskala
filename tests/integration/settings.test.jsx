import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import { SettingsManagement } from "../../src/features/settings";
import { getJakartaDateKey } from "../../src/shared/lib/dates";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  addPaymentSource: vi.fn(),
  addPaymentSourceMutation: vi.fn(),
  getOrderPlatforms: vi.fn(),
  getPaymentSourceMutations: vi.fn(),
  getPaymentSources: vi.fn(),
  getShoppingSuppliers: vi.fn(),
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
    expect(purchaseRow).toHaveTextContent("2026-10-02");
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
