import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { SnackbarProvider } from "notistack";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx-js-style";
import * as api from "../../src/https/index";
import ShoppingManagement from "../../src/features/inventory/components/ShoppingManagement";
import ReceiptPicker from "../../src/features/inventory/components/shopping/ReceiptPicker";
import usePurchaseForm from "../../src/features/inventory/hooks/usePurchaseForm";
import { periodRange, rangeLabel } from "../../src/features/inventory/utils/periods";
import { historyTabOf } from "../../src/features/inventory/utils/purchaseKinds";
import * as receiptImages from "../../src/features/inventory/utils/receiptImages";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  deletePurchaseAttachment: vi.fn(),
  deletePurchaseDraft: vi.fn(),
  deletePurchaseItem: vi.fn(),
  getPaymentSources: vi.fn(),
  getPurchaseDrafts: vi.fn(),
  getPurchaseNotas: vi.fn(),
  getPurchases: vi.fn(),
  getShoppingSuppliers: vi.fn(),
  getSupplyPurchaseDrafts: vi.fn(),
  getSupplyPurchaseNotas: vi.fn(),
  getSupplyPurchases: vi.fn(),
  savePurchase: vi.fn(),
  saveSupplyPurchase: vi.fn(),
  updatePurchaseDraft: vi.fn(),
  updatePurchaseItem: vi.fn(),
  uploadPurchaseAttachments: vi.fn(),
  uploadSupplyPurchaseAttachments: vi.fn(),
}));
// The Excel export is read back from the workbook instead of written to disk.
// xlsx-js-style is CommonJS: its functions sit on the default export.
vi.mock("xlsx-js-style", async (importOriginal) => {
  const actual = await importOriginal();
  const library = actual.default ?? actual;
  const writeFile = vi.fn();
  return { ...library, writeFile, default: { ...library, writeFile } };
});
// jsdom cannot decode images; the photos are sent as picked. It also has no
// camera, so each camera test says whether the device is a phone.
vi.mock("../../src/features/inventory/utils/receiptImages", async (importOriginal) => ({
  ...(await importOriginal()),
  compressReceiptImage: vi.fn(),
  supportsNativeCapture: vi.fn(),
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
  attachments: [],
  ...overrides,
});
const receipts = [
  { id: 3, url: "/api/shopping/purchase-attachments/3", name: "nota.jpg" },
  { id: 4, url: "/api/shopping/purchase-attachments/4", name: "kuitansi.jpg" },
];
const sources = [
  { id: 1, name: "Kasir (Tunai)", balance: 85000, isActive: true },
  { id: 2, name: "Niskala", balance: 10000, isActive: true },
];
// The history opens on Bulan Ini.
const thisMonth = periodRange("month");
const photo = (name, type = "image/jpeg") => new File(["x"], name, { type });
// No draft nota and no posted nota (Per Nota) unless a test sets them.
beforeEach(() => {
  api.getPurchaseDrafts.mockResolvedValue({ data: { data: [] } });
  api.getSupplyPurchaseDrafts.mockResolvedValue({ data: { data: [] } });
  api.getPurchaseNotas.mockResolvedValue({ data: { data: { notas: [], total: 0, page: 1 } } });
  api.getSupplyPurchaseNotas.mockResolvedValue({ data: { data: { notas: [], total: 0, page: 1 } } });
});
// A posted nota as listed by the Per Nota history.
const postedNota = (id, overrides = {}) => ({
  id,
  kind: "raw",
  date: "2026-09-15",
  suplierId: 1,
  supplierName: "Pasar Uji",
  paymentSourceId: 1,
  paymentMethod: "Kasir (Tunai)",
  note: "Belanja mingguan",
  subtotal: 100000,
  shippingCost: 10000,
  discountType: "percent",
  discountValue: 10,
  discountAmount: 10000,
  taxPercent: 11,
  taxAmount: 11000,
  total: 111000,
  createdBy: "Kasir Uji",
  createdAt: "2026-09-15 08:00:00",
  postedBy: "Admin Uji",
  postedAt: "2026-09-15 09:30:00",
  items: [
    { id: 71, stockItemId: 5, itemName: "Gula", quantity: 2000, unit: "gr", unitPrice: 15, total: 30000, costTotal: 33300, stockQuantity: 2000, stockUnit: "gr", stockAverageCost: 15, stockValueAfter: 36250 },
    { id: 72, stockItemId: 6, itemName: "Kopi", quantity: 1, unit: "kg", unitPrice: 50000, total: 50000, costTotal: 55500, stockQuantity: 1000, stockUnit: "gr", stockAverageCost: 56, stockValueAfter: 56000 },
    { id: 73, stockItemId: 7, itemName: "Teh", quantity: 500, unit: "gr", unitPrice: 30, total: 15000, costTotal: 16650, stockQuantity: 500, stockUnit: "gr", stockAverageCost: 33, stockValueAfter: 16500 },
    { id: 74, stockItemId: 8, itemName: "Susu", quantity: 1, unit: "liter", unitPrice: 5000, total: 5000, costTotal: 5550, stockQuantity: 1000, stockUnit: "ml", stockAverageCost: 6, stockValueAfter: 6000 },
  ],
  attachments: [],
  ...overrides,
});
// notistack's enqueueSnackbar works once a SnackbarProvider exists, as in the app.
const hookWrapper = ({ children }) => (
  <SnackbarProvider>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {children}
    </QueryClientProvider>
  </SnackbarProvider>
);

const itemGroups = [
  {
    stockItemId: 5,
    itemName: "Gula",
    stock: 2500,
    stockUnit: "gr",
    averageCost: 14.5,
    stockValue: 36250,
    purchaseCount: 2,
    histories: [history(91, { attachments: receipts }), history(90, { purchaseId: 6, purchaseDate: "2026-09-01", quantity: 500, total: 7500 })],
    logs: [
      { id: 1, action: "create", userName: "Admin Uji", createdAt: "2026-09-15T03:00:00Z", newData: { quantity: 2000, unit: "gr", unitPrice: 15 } },
      { id: 2, action: "edit", userName: "Admin Uji", createdAt: "2026-09-16T03:00:00Z", oldData: { quantity: 400, unit: "gr", unitPrice: 20 }, newData: { quantity: 500, unit: "gr", unitPrice: 15 } },
    ],
  },
];
const stockItems = [{ id: 5, name: "Gula", unit: "gr" }];

const renderShopping = (isAdmin = true) =>
  renderWithProviders(<ShoppingManagement stockItems={stockItems} isAdmin={isAdmin} />);
// Opens the detail of Gula (stok, COGS, riwayat, log) from its line in nota #7.
const openGulaDetail = async (isAdmin = true) => {
  api.getPurchaseNotas.mockResolvedValue({ data: { data: { notas: [postedNota(7)], total: 1, page: 1 } } });
  const view = renderShopping(isAdmin);
  const nota = await screen.findByRole("rowgroup", { name: "Nota #7 Pasar Uji" });
  fireEvent.click(within(nota).getByText("Gula").closest("tr"));
  await screen.findByRole("dialog");
  return view;
};

describe("shopping history", () => {
  beforeEach(() => {
    api.getShoppingSuppliers.mockResolvedValue({ data: { data: [{ id: 1, name: "Pasar Uji" }] } });
    api.getPurchases.mockResolvedValue({ data: { data: { purchases: [], itemGroups, groupTotal: 12, total: 2 } } });
    api.getPaymentSources.mockResolvedValue({ data: { data: sources } });
    receiptImages.compressReceiptImage.mockImplementation(async (file) => file);
    URL.createObjectURL = vi.fn((file) => `blob:${file.name}`);
    URL.revokeObjectURL = vi.fn();
  });

  it("lists Per Bahan: the latest purchase per item with its COGS, paged and searchable", async () => {
    renderShopping();
    fireEvent.click(await screen.findByRole("button", { name: "Per Bahan" }));

    const row = (await screen.findByText("2 history")).closest("tr");
    expect(row).toHaveTextContent("Gula");
    expect(row).toHaveTextContent("#7 - Cash · 2 bukti");
    expect(row).toHaveTextContent("2.000 gr");
    expect(row).toHaveTextContent("Rp 30.000");
    expect(row).toHaveTextContent("Rp 15 / gr");
    expect(screen.getByRole("columnheader", { name: "COGS Setelah" })).toBeInTheDocument();
    expect(screen.queryByText("TOTAL PENGELUARAN")).not.toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(api.getPurchases).toHaveBeenLastCalledWith({ search: "", page: 1, ...thisMonth });

    fireEvent.click(screen.getByRole("button", { name: "Berikutnya" }));
    await waitFor(() => expect(api.getPurchases).toHaveBeenLastCalledWith({ search: "", page: 2, ...thisMonth }));
    fireEvent.change(screen.getByLabelText("Cari riwayat belanja"), { target: { value: "gul" } });
    await waitFor(() => expect(api.getPurchases).toHaveBeenLastCalledWith({ search: "gul", page: 1, ...thisMonth }));

    // A row opens the same detail as a line of a struk.
    fireEvent.click(screen.getByText("2 history").closest("tr"));
    expect(within(screen.getByRole("dialog")).getByText("2 history pembelian")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tutup" }));

    // Back to Per Struk.
    fireEvent.click(screen.getByRole("button", { name: "Per Struk" }));
    expect(await screen.findByText("Belum ada belanja bahan baku tersimpan.")).toBeInTheDocument();
    expect(api.getPurchaseNotas).toHaveBeenLastCalledWith({ search: "gul", page: 1, ...thisMonth });
  });

  it("shows item detail with history, activity log and admin actions", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    api.deletePurchaseItem.mockResolvedValue({ data: { success: true } });
    await openGulaDetail();
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
    await openGulaDetail();
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
    const { unmount } = await openGulaDetail(false);
    expect(screen.queryByRole("button", { name: "Update" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tutup" }));
    // Kasir may write a draft nota but not post it.
    fireEvent.click(screen.getByRole("button", { name: "Tambah Belanja" }));
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Simpan Draft" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Simpan & Posting" })).not.toBeInTheDocument();
    unmount();

    renderShopping(true);
    fireEvent.click(await screen.findByRole("button", { name: "Tambah Belanja" }));
    const form = screen.getByRole("dialog");
    fireEvent.change(within(form).getByLabelText("Catatan (opsional)"), { target: { value: "draft note" } });
    fireEvent.change(within(form).getByLabelText("Gramasi"), { target: { value: "1/2" } });
    fireEvent.change(within(form).getByLabelText("Harga Total"), { target: { value: "15000" } });
    expect(form).toHaveTextContent("Total: Rp 15.000");
    // Required inputs are filled; supplier and item are still missing.
    fireEvent.click(screen.getByRole("button", { name: "Simpan & Posting" }));
    expect(await screen.findByText("Lengkapi toko, barang, gramasi, satuan, dan harga total.")).toBeInTheDocument();
    expect(api.savePurchase).not.toHaveBeenCalled();

    // The draft survives closing and reopening the form.
    fireEvent.click(screen.getByRole("button", { name: "Tutup form" }));
    fireEvent.click(screen.getByRole("button", { name: "Tambah Belanja" }));
    expect(screen.getByDisplayValue("draft note")).toBeInTheDocument();
  });

  it("pays from the first payment source and shows its saldo after the purchase", async () => {
    renderShopping(true);
    fireEvent.click(await screen.findByRole("button", { name: "Tambah Belanja" }));
    const form = screen.getByRole("dialog");
    expect(within(form).getByText("Informasi Nota")).toBeInTheDocument();

    const balance = await within(form).findByTestId("payment-source-balance");
    const sourceSelect = within(form).getByLabelText("Sumber Pembayaran");
    expect(sourceSelect).toHaveValue("1");
    expect(Array.from(sourceSelect.options, (option) => option.text)).toEqual([
      "",
      "Kasir (Tunai) (Rp 85.000)",
      "Niskala (Rp 10.000)",
    ]);
    expect(balance).toHaveTextContent("Saldo Rp 85.000, setelah belanja Rp 85.000");
    fireEvent.change(within(form).getByLabelText("Harga Total"), { target: { value: "95000" } });
    expect(balance).toHaveTextContent("setelah belanja -Rp 10.000");
    expect(within(balance).getByText("-Rp 10.000")).toHaveClass("text-red-400");
  });

  it("adds bukti nota from the camera or the gallery", async () => {
    renderShopping(true);
    fireEvent.click(await screen.findByRole("button", { name: "Tambah Belanja" }));
    const form = screen.getByRole("dialog");
    const camera = within(form).getByLabelText("Ambil foto bukti nota");
    const gallery = within(form).getByLabelText("Pilih bukti nota dari galeri");
    expect(camera).toHaveAttribute("capture", "environment");
    expect(camera).toHaveAttribute("accept", "image/*");
    expect(gallery).toHaveAttribute("multiple");
    expect(gallery).not.toHaveAttribute("capture");

    fireEvent.change(camera, { target: { files: [photo("kamera.jpg")] } });
    expect(await within(form).findByAltText("Bukti nota 1")).toHaveAttribute("src", "blob:kamera.jpg");
    fireEvent.change(gallery, { target: { files: [photo("galeri.png", "image/png"), photo("catatan.pdf", "application/pdf")] } });
    expect(await within(form).findByAltText("Bukti nota 2")).toHaveAttribute("src", "blob:galeri.png");
    expect(await screen.findByText("Hanya file foto yang bisa dipakai sebagai bukti nota.")).toBeInTheDocument();
    expect(form).toHaveTextContent("2 / 5 foto");

    fireEvent.click(within(form).getByRole("button", { name: "Hapus foto bukti 1" }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:kamera.jpg");
    expect(within(form).getAllByRole("img")).toHaveLength(1);

    fireEvent.change(gallery, { target: { files: [1, 2, 3, 4, 5].map((n) => photo(`foto-${n}.jpg`)) } });
    await waitFor(() => expect(within(form).getAllByRole("img")).toHaveLength(5));
    expect(await screen.findByText("Maksimal 5 foto bukti per belanja.")).toBeInTheDocument();
    expect(camera).toBeDisabled();
  });

  it("shows the bukti nota of a purchase and lets admins delete one", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    api.deletePurchaseAttachment.mockResolvedValue({ data: { success: true } });
    await openGulaDetail(true);
    const history = screen.getByRole("dialog");
    expect(within(history).getByRole("button", { name: "+ Bukti" })).toBeInTheDocument();
    fireEvent.click(within(history).getByRole("button", { name: "Bukti (2)" }));

    const dialog = screen.getByRole("dialog", { name: "Bukti Nota #7" });
    expect(within(dialog).getByAltText("Bukti nota 1 belanja #7").getAttribute("src")).toMatch(/\/api\/shopping\/purchase-attachments\/3$/);
    expect(within(dialog).getByText("kuitansi.jpg")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Hapus bukti nota 2" }));
    expect(window.confirm).toHaveBeenCalledWith("Hapus bukti nota 2 dari belanja #7?");
    await waitFor(() => expect(api.deletePurchaseAttachment.mock.calls[0][0]).toBe(4));

    // Escape closes only the bukti dialog.
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Bukti Nota #7" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent("2 history pembelian");
  });

  it("lets cashiers view bukti nota without changing them", async () => {
    await openGulaDetail(false);
    expect(screen.queryByRole("button", { name: "+ Bukti" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bukti (2)" }));
    const dialog = screen.getByRole("dialog", { name: "Bukti Nota #7" });
    expect(within(dialog).getAllByRole("img")).toHaveLength(2);
    expect(within(dialog).queryByRole("button", { name: /Hapus bukti/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Ambil foto bukti nota")).not.toBeInTheDocument();
    // Kasir get the sources (without saldo) for their draft nota.
    expect(api.getPaymentSources).toHaveBeenCalled();
  });

  it("lists each nota with its barang and the TOTAL PENGELUARAN of all pages, paged and searchable", async () => {
    api.getPurchaseNotas.mockResolvedValue({
      data: { data: { notas: [postedNota(7, { attachments: receipts })], total: 12, totalSpending: 30227346, page: 1 } },
    });
    renderShopping();

    const nota = await screen.findByRole("rowgroup", { name: "Nota #7 Pasar Uji" });
    // Per Struk first; Per Bahan is the other view.
    const views = screen.getByRole("group", { name: "Tampilan riwayat" });
    expect(within(views).getAllByRole("button").map((button) => button.textContent)).toEqual(["Per Struk", "Per Bahan"]);
    expect(within(views).getByRole("button", { name: "Per Struk" })).toHaveAttribute("aria-pressed", "true");
    expect(nota).toHaveTextContent("Pasar Uji2026-09-15 · Nota #7 · Dibuat Kasir Uji · Diposting Admin Uji");
    expect(nota).toHaveTextContent("Catatan: Belanja mingguan");
    expect(within(nota).getByRole("button", { name: "Bukti (2)" })).toBeInTheDocument();
    // Each barang on its own row; the sumber pembayaran once for the nota.
    const gula = within(nota).getByText("Gula").closest("tr");
    // No Masuk Stok / COGS Setelah columns here; the barang detail shows the COGS.
    expect(Array.from(gula.cells, (cell) => cell.textContent)).toEqual(["Gula", "Kasir (Tunai)", "2.000 gr", "Rp 15", "Rp 30.000"]);
    expect(screen.queryByRole("columnheader", { name: "Masuk Stok" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "COGS Setelah" })).not.toBeInTheDocument();
    expect(within(nota).getByText("Kopi").closest("tr")).toHaveTextContent("1 kgRp 50.000Rp 50.000");
    // The Grand Total of every nota (12, on 2 pages) closes the table, under Jumlah.
    const footer = screen.getByText("TOTAL PENGELUARAN").closest("tr");
    expect(Array.from(footer.cells, (cell) => cell.textContent)).toEqual([`TOTAL PENGELUARAN12 nota · Bulan Ini (${rangeLabel(thisMonth)}), semua halaman`, "Rp 30.227.346"]);
    expect(footer.cells[0].colSpan).toBe(4);
    expect(within(nota).getAllByText("Kasir (Tunai)")).toHaveLength(1);
    expect(within(nota).getByText("Kopi").closest("tr")).toHaveTextContent("1 kgRp 50.000Rp 50.000");
    expect(within(nota).getByText("Ongkir").closest("tr")).toHaveTextContent("Ongkir1Rp 10.000Rp 10.000");
    expect(within(nota).getByText("Diskon Nota (10%)").closest("tr")).toHaveTextContent("-Rp 10.000");
    expect(within(nota).getByText("PPN 11%").closest("tr")).toHaveTextContent("Rp 11.000");
    expect(within(nota).getByText("Total").closest("tr")).toHaveTextContent("TotalRp 111.000");
    expect(api.getPurchaseNotas).toHaveBeenLastCalledWith({ search: "", page: 1, ...thisMonth });
    expect(api.getPurchases).not.toHaveBeenCalled();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Berikutnya" }));
    await waitFor(() => expect(api.getPurchaseNotas).toHaveBeenLastCalledWith({ search: "", page: 2, ...thisMonth }));
    fireEvent.change(screen.getByLabelText("Cari riwayat belanja"), { target: { value: "kop" } });
    await waitFor(() => expect(api.getPurchaseNotas).toHaveBeenLastCalledWith({ search: "kop", page: 1, ...thisMonth }));
    expect(api.getPurchases).not.toHaveBeenCalled();
  });

  it("opens the barang detail with its COGS from a nota line", async () => {
    api.getPurchaseNotas.mockResolvedValue({
      data: { data: { notas: [postedNota(7, { attachments: receipts })], total: 1, page: 1 } },
    });
    api.updatePurchaseItem.mockResolvedValue({ data: { success: true } });
    renderShopping();
    const nota = await screen.findByRole("rowgroup", { name: "Nota #7 Pasar Uji" });
    fireEvent.click(within(nota).getByText("Gula").closest("tr"));

    // Stok, nilai, COGS, riwayat with COGS Setelah and log, kept to this barang.
    const dialog = await screen.findByRole("dialog");
    expect(api.getPurchases).toHaveBeenLastCalledWith({ itemId: 5, page: 1 });
    expect(within(dialog).getByRole("heading", { name: "Gula" })).toBeInTheDocument();
    expect(within(dialog).getByText("2 history pembelian")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("COGS Sekarang");
    expect(dialog).toHaveTextContent("Rp 36.250");
    expect(within(dialog).getByRole("columnheader", { name: "COGS Setelah" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /^Nota #7/ })).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getAllByRole("button", { name: "Update" })[0]);
    const editForm = screen.getByText(/^Edit Belanja/).closest("form");
    fireEvent.change(within(editForm).getByLabelText("Harga Total"), { target: { value: "40000" } });
    fireEvent.click(within(editForm).getByRole("button", { name: "Simpan" }));
    await waitFor(() =>
      expect(api.updatePurchaseItem.mock.calls[0][0]).toEqual({ id: 91, quantity: 2000, unit: "gr", unitPrice: 20 })
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Log Aktivitas" }));
    expect(dialog).toHaveTextContent("400 gr -> 500 gr, Rp 20 -> Rp 15");
    fireEvent.click(within(dialog).getByRole("button", { name: "Tutup" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // The bukti of the nota open from its heading.
    fireEvent.click(within(nota).getByRole("button", { name: "Bukti (2)" }));
    expect(within(screen.getByRole("dialog", { name: "Bukti Nota #7" })).getByText("kuitansi.jpg")).toBeInTheDocument();
  });

  it("lets kasir open a barang from a nota without admin actions", async () => {
    api.getPurchaseNotas.mockResolvedValue({ data: { data: { notas: [postedNota(8)], total: 1, page: 1 } } });
    renderShopping(false);
    const nota = await screen.findByRole("rowgroup", { name: "Nota #8 Pasar Uji" });
    expect(within(nota).queryByRole("button", { name: "+ Bukti" })).not.toBeInTheDocument();
    fireEvent.click(within(nota).getByRole("button", { name: "Gula" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("2 history pembelian")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Update" })).not.toBeInTheDocument();
  });
});

describe("purchase form submit", () => {
  const wrapper = hookWrapper;
  const fillAndSubmit = async (onSaved) => {
    const { result } = renderHook(
      () => usePurchaseForm({ suppliers: [{ id: 1, name: "Pasar Uji" }], stockItems, paymentSources: sources, onSaved }),
      { wrapper }
    );
    act(() => {
      result.current.setForm((current) => ({ ...current, suplierId: 1, note: "nota pasar" }));
      result.current.updateRow(result.current.rows[0].key, { stockItemId: 5, quantity: "2", unit: "gr", unitPrice: "30000" });
    });
    await act(() => result.current.addReceipts([photo("nota.jpg")]));
    await act(() => result.current.submit({ preventDefault() {} }));
    return result;
  };

  beforeEach(() => {
    receiptImages.compressReceiptImage.mockImplementation(async (file) => file);
    URL.createObjectURL = vi.fn((file) => `blob:${file.name}`);
    URL.revokeObjectURL = vi.fn();
    api.savePurchase.mockResolvedValue({ data: { data: { id: 44, total: 30000, balance: 55000 } } });
  });

  it("sends the payment source and uploads the bukti nota after the purchase is saved", async () => {
    api.uploadPurchaseAttachments.mockResolvedValue({ data: { data: [] } });
    const onSaved = vi.fn();
    const result = await fillAndSubmit(onSaved);

    const payload = api.savePurchase.mock.calls[0][0];
    expect(payload).toMatchObject({ suplierId: 1, paymentSourceId: 1, note: "nota pasar" });
    expect(payload).not.toHaveProperty("paymentMethod");
    expect(payload.requestId).toMatch(/^[a-f0-9]{32}$/);
    expect(api.uploadPurchaseAttachments).toHaveBeenCalledWith({
      purchaseId: 44,
      files: [expect.objectContaining({ name: "nota.jpg" })],
    });
    expect(onSaved).toHaveBeenCalled();
    expect(result.current.receipts).toEqual([]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:nota.jpg");
  });

  it("keeps the saved purchase when the bukti upload fails", async () => {
    api.uploadPurchaseAttachments.mockRejectedValue(new Error("offline"));
    const onSaved = vi.fn();
    await fillAndSubmit(onSaved);
    expect(api.savePurchase).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalled();
  });
});

describe("Ambil Foto", () => {
  const track = { stop: vi.fn() };
  const getUserMedia = vi.fn();
  const setCamera = ({ secure = true, mediaDevices = { getUserMedia } } = {}) => {
    Object.defineProperty(window, "isSecureContext", { value: secure, configurable: true });
    Object.defineProperty(navigator, "mediaDevices", { value: mediaDevices, configurable: true });
  };
  const renderPicker = () => {
    const onAdd = vi.fn();
    render(<ReceiptPicker receipts={[]} onAdd={onAdd} onRemove={vi.fn()} max={5} />);
    return onAdd;
  };

  beforeEach(() => {
    track.stop = vi.fn();
    getUserMedia.mockResolvedValue({ getTracks: () => [track] });
    receiptImages.supportsNativeCapture.mockReturnValue(false);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() });
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done) =>
      done(new Blob(["jpeg"], { type: "image/jpeg" }))
    );
    URL.createObjectURL = vi.fn(() => "blob:jepretan");
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    delete window.isSecureContext;
    delete navigator.mediaDevices;
  });

  it("opens the webcam on a computer and adds the photo taken", async () => {
    setCamera();
    const onAdd = renderPicker();
    fireEvent.click(screen.getByRole("button", { name: "Ambil Foto" }));

    const dialog = screen.getByRole("dialog", { name: "Ambil Foto Bukti Nota" });
    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({ audio: false, video: expect.objectContaining({ facingMode: { ideal: "environment" } }) })
    );
    const shutter = within(dialog).getByRole("button", { name: "Jepret" });
    await waitFor(() => expect(shutter).toBeEnabled());
    fireEvent.click(shutter);
    expect(within(dialog).getByAltText("Hasil foto bukti nota")).toHaveAttribute("src", "blob:jepretan");

    fireEvent.click(within(dialog).getByRole("button", { name: "Ulangi" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Jepret" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Pakai Foto" }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    const [[[file]]] = onAdd.mock.calls;
    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe("image/jpeg");
    expect(file.name).toMatch(/^bukti-nota-\d+\.jpg$/);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(track.stop).toHaveBeenCalled();
  });

  it("explains a refused camera permission and closes with Escape", async () => {
    setCamera();
    getUserMedia.mockRejectedValue(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
    renderPicker();
    fireEvent.click(screen.getByRole("button", { name: "Ambil Foto" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Izin kamera ditolak");
    expect(screen.getByRole("button", { name: "Jepret" })).toBeDisabled();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("uses the camera app of phones and tablets", () => {
    setCamera();
    receiptImages.supportsNativeCapture.mockReturnValue(true);
    const click = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    renderPicker();
    fireEvent.click(screen.getByRole("button", { name: "Ambil Foto" }));

    expect(click.mock.contexts[0]).toBe(screen.getByLabelText("Ambil foto bukti nota"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("falls back to the file chooser when the page cannot use a webcam", () => {
    setCamera({ secure: false });
    const click = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    renderPicker();
    fireEvent.click(screen.getByRole("button", { name: "Ambil Foto" }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("belanja lainnya in the same form", () => {
  const supplyItems = [{ id: 31, name: "Gas LPG", category: "Perlengkapan", unit: "tabung" }];
  const supplyGroups = [
    {
      stockItemId: 31,
      itemName: "Gas LPG",
      category: "Perlengkapan",
      stock: 3,
      stockUnit: "tabung",
      averageCost: 22000,
      stockValue: 66000,
      purchaseCount: 1,
      histories: [history(81, { purchaseId: 21, itemName: "Gas LPG", paymentMethod: "Kasir (Tunai)", quantity: 3, unit: "tabung", unitPrice: 22000, total: 66000, stockQuantity: 3, stockUnit: "tabung", stockAverageCost: 22000, stockValueAfter: 66000 })],
      logs: [],
    },
  ];
  const renderBoth = () =>
    renderWithProviders(<ShoppingManagement stockItems={stockItems} supplyItems={supplyItems} isAdmin />);
  // Select2 also labels its own widget, so pick the native <select>.
  const selectByLabel = (container, label) =>
    within(container).getAllByLabelText(label).find((element) => element.tagName === "SELECT");
  const optionTexts = (select) => Array.from(select.options, (option) => option.text).filter(Boolean);

  beforeEach(() => {
    api.getShoppingSuppliers.mockResolvedValue({ data: { data: [{ id: 1, name: "Pasar Uji" }] } });
    api.getPurchases.mockResolvedValue({ data: { data: { purchases: [], itemGroups, groupTotal: 1, total: 1 } } });
    api.getSupplyPurchases.mockResolvedValue({ data: { data: { itemGroups: supplyGroups, groupTotal: 1, page: 1 } } });
    api.getPaymentSources.mockResolvedValue({ data: { data: sources } });
    receiptImages.compressReceiptImage.mockImplementation(async (file) => file);
    URL.createObjectURL = vi.fn((file) => `blob:${file.name}`);
    URL.revokeObjectURL = vi.fn();
  });

  it("switches Jenis Belanja inside Tambah Belanja", async () => {
    renderBoth();
    fireEvent.click(await screen.findByRole("button", { name: "Tambah Belanja" }));
    const form = screen.getByRole("dialog");
    const kinds = within(form).getByRole("group", { name: "Jenis Belanja" });
    expect(within(kinds).getByRole("button", { name: "Bahan Baku" })).toHaveAttribute("aria-pressed", "true");
    expect(optionTexts(selectByLabel(form, "Cari atau buat barang"))).toEqual(["Gula"]);
    fireEvent.change(within(form).getByLabelText("Gramasi"), { target: { value: "5" } });

    fireEvent.click(within(kinds).getByRole("button", { name: "Lainnya" }));
    expect(within(kinds).getByRole("button", { name: "Lainnya" })).toHaveAttribute("aria-pressed", "true");
    expect(form).toHaveTextContent("Peralatan, perlengkapan, promosi, dan lain-lain.");
    expect(optionTexts(selectByLabel(form, "Cari atau buat barang lainnya"))).toEqual(["Gas LPG"]);
    expect(optionTexts(selectByLabel(form, "Kategori barang 1"))).toEqual(["Peralatan", "Perlengkapan", "Promosi", "Lain-lain"]);
    // Barang Lainnya are counted per piece: no Satuan.
    expect(within(form).queryAllByLabelText("Satuan")).toHaveLength(0);
    // The item lines start over; the nota stays.
    expect(within(form).getByLabelText("Qty")).toHaveValue("");
    expect(selectByLabel(form, "Sumber Pembayaran")).toHaveValue("1");
    expect(within(form).getByRole("button", { name: "Ambil Foto" })).toBeInTheDocument();
  });

  it("shows the nota of barang lainnya per kategori next to bahan baku", async () => {
    renderBoth();
    const kinds = screen.getByRole("group", { name: "Riwayat jenis belanja" });
    expect(within(kinds).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Bahan Baku",
      "Peralatan",
      "Perlengkapan",
      "Promosi",
      "Lain-lain",
    ]);
    fireEvent.click(within(kinds).getByRole("button", { name: "Perlengkapan" }));
    expect(within(kinds).getByRole("button", { name: "Perlengkapan" })).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByText("Belum ada belanja perlengkapan tersimpan.")).toBeInTheDocument();
    expect(api.getSupplyPurchaseNotas).toHaveBeenLastCalledWith({ search: "", page: 1, category: "Perlengkapan", ...thisMonth });
    expect(api.getSupplyPurchases).not.toHaveBeenCalled();

    // Barang Lainnya are not bahan: their per-item view is Per Barang, without units.
    const views = screen.getByRole("group", { name: "Tampilan riwayat" });
    expect(within(views).getAllByRole("button").map((button) => button.textContent)).toEqual(["Per Struk", "Per Barang"]);
    fireEvent.click(within(views).getByRole("button", { name: "Per Barang" }));
    const row = (await screen.findByText("Gas LPG")).closest("tr");
    expect(api.getSupplyPurchases).toHaveBeenLastCalledWith({ search: "", page: 1, category: "Perlengkapan", ...thisMonth });
    expect(row).toHaveTextContent("#21 - Kasir (Tunai)");
    expect(row).not.toHaveTextContent("tabung");
    expect(screen.getByRole("columnheader", { name: "Qty" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Harga Rata-rata Setelah" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "COGS Setelah" })).not.toBeInTheDocument();
  });

  it("shows a nota of barang lainnya under each kategori it holds, without units", async () => {
    const mixed = postedNota(31, {
      kind: "supply",
      supplierName: "Toko Campur",
      subtotal: 80000,
      shippingCost: 0,
      discountType: "amount",
      discountValue: 0,
      discountAmount: 0,
      taxPercent: 0,
      taxAmount: 0,
      total: 80000,
      items: [
        { id: 81, supplyItemId: 41, itemName: "Spanduk", category: "Promosi", quantity: 1, unit: "pcs", unitPrice: 50000, total: 50000, costTotal: 50000, stockQuantity: 1, stockUnit: "pcs" },
        { id: 82, supplyItemId: 42, itemName: "Pisau", category: "Peralatan", quantity: 2, unit: "pcs", unitPrice: 15000, total: 30000, costTotal: 30000, stockQuantity: 2, stockUnit: "pcs" },
      ],
    });
    api.getSupplyPurchaseNotas.mockImplementation(async ({ category }) => ({
      data: { data: { notas: ["Promosi", "Peralatan"].includes(category) ? [mixed] : [], total: 1, page: 1 } },
    }));
    renderBoth();
    const kinds = screen.getByRole("group", { name: "Riwayat jenis belanja" });
    fireEvent.click(within(kinds).getByRole("button", { name: "Promosi" }));

    const row = await screen.findByRole("rowgroup", { name: "Nota #31 Toko Campur" });
    expect(api.getSupplyPurchaseNotas).toHaveBeenLastCalledWith({ search: "", page: 1, category: "Promosi", ...thisMonth });
    expect(within(row).getByText("Pisau").closest("tr")).toHaveTextContent("Pisau2Rp 15.000Rp 30.000");
    expect(row).not.toHaveTextContent("pcs");
    expect(within(screen.getByRole("table")).getByRole("columnheader", { name: "Qty" })).toBeInTheDocument();

    // A line opens that barang's detail with its Harga Rata-rata, without units.
    const pisauGroup = {
      ...supplyGroups[0],
      stockItemId: 42,
      itemName: "Pisau",
      category: "Peralatan",
      stock: 2,
      stockUnit: "pcs",
      averageCost: 15000,
      stockValue: 30000,
      histories: [history(82, { purchaseId: 31, itemName: "Pisau", supplierName: "Toko Campur", paymentMethod: "Kasir (Tunai)", quantity: 2, unit: "pcs", unitPrice: 15000, total: 30000, stockQuantity: 2, stockUnit: "pcs", stockAverageCost: 15000, stockValueAfter: 30000 })],
    };
    api.getSupplyPurchases.mockImplementation(async ({ itemId }) => ({
      data: { data: { itemGroups: itemId === 42 ? [pisauGroup] : supplyGroups, groupTotal: 1, page: 1 } },
    }));
    fireEvent.click(within(row).getByText("Pisau").closest("tr"));
    const dialog = await screen.findByRole("dialog");
    expect(api.getSupplyPurchases).toHaveBeenLastCalledWith({ itemId: 42, page: 1 });
    expect(within(dialog).getByRole("heading", { name: "Pisau" })).toBeInTheDocument();
    expect(dialog).toHaveTextContent("1 history pembelian · Peralatan");
    // Barang Lainnya never reach HPP: the average purchase price, not a COGS.
    expect(dialog).toHaveTextContent("Harga Rata-rata SekarangRp 15.000");
    expect(within(dialog).getByRole("columnheader", { name: "Harga Rata-rata Setelah" })).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("COGS");
    expect(within(dialog).getByRole("columnheader", { name: "Harga per Barang" })).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("pcs");
    fireEvent.click(within(dialog).getByRole("button", { name: "Tutup" }));

    fireEvent.click(within(kinds).getByRole("button", { name: "Lain-lain" }));
    expect(await screen.findByText("Belum ada belanja lain-lain tersimpan.")).toBeInTheDocument();
    expect(api.getSupplyPurchaseNotas).toHaveBeenLastCalledWith({ search: "", page: 1, category: "Lain-lain", ...thisMonth });
  });

  it("lays a nota out like the paper one: barang, ongkir, and the total under Jumlah", async () => {
    const line = (id, itemName, quantity, unitPrice) => ({
      id,
      supplyItemId: id,
      itemName,
      category: "Perlengkapan",
      quantity,
      unit: "pcs",
      unitPrice,
      total: quantity * unitPrice,
      costTotal: quantity * unitPrice,
      stockQuantity: quantity,
      stockUnit: "pcs",
      stockAverageCost: unitPrice,
      stockValueAfter: quantity * unitPrice,
    });
    const shopee = postedNota(40, {
      kind: "supply",
      supplierName: "Shopee",
      paymentMethod: "Niskala",
      subtotal: 390000,
      shippingCost: 336,
      discountType: "amount",
      discountValue: 0,
      discountAmount: 0,
      taxPercent: 0,
      taxAmount: 0,
      total: 390336,
      items: [
        line(91, "Spork (Sendok + Garpu) dengan Plastik Pembungkus untuk Makanan", 500, 275),
        line(92, "Cutlery Set untuk Catering (Sendok, Garpu Tisu, tusuk Gigi)", 500, 505),
      ],
    });
    api.getSupplyPurchaseNotas.mockResolvedValue({ data: { data: { notas: [shopee], total: 1, totalSpending: 390336, page: 1 } } });
    renderBoth();
    fireEvent.click(within(screen.getByRole("group", { name: "Riwayat jenis belanja" })).getByRole("button", { name: "Perlengkapan" }));

    const nota = await screen.findByRole("rowgroup", { name: "Nota #40 Shopee" });
    const rows = within(nota)
      .getAllByRole("row")
      .map((row) => Array.from(row.cells, (cell) => cell.textContent));
    expect(rows).toEqual([
      ["Shopee2026-09-15 · Nota #40 · Dibuat Kasir Uji · Diposting Admin UjiCatatan: Belanja mingguan+ Bukti"],
      ["Spork (Sendok + Garpu) dengan Plastik Pembungkus untuk Makanan", "Niskala", "500", "Rp 275", "Rp 137.500"],
      ["Cutlery Set untuk Catering (Sendok, Garpu Tisu, tusuk Gigi)", "500", "Rp 505", "Rp 252.500"],
      ["Ongkir", "1", "Rp 336", "Rp 336"],
      ["Total", "Rp 390.336"],
    ]);
    expect(screen.getByTestId("total-spending")).toHaveTextContent("Rp 390.336");
  });

  it("opens the tab of what was just posted", () => {
    expect(historyTabOf("supply", "Promosi").key).toBe("supply:Promosi");
    expect(historyTabOf("supply", "").key).toBe("supply:Peralatan");
    expect(historyTabOf("raw", "").key).toBe("raw");
  });

  describe("submit", () => {
    const wrapper = hookWrapper;

    it("needs a category for a new barang lainnya and saves it without unit", async () => {
      api.saveSupplyPurchase.mockResolvedValue({ data: { data: { id: 21, total: 194000 } } });
      api.uploadSupplyPurchaseAttachments.mockResolvedValue({ data: { data: [] } });
      const onSaved = vi.fn();
      const { result } = renderHook(
        () => usePurchaseForm({ suppliers: [{ id: 1, name: "Pasar Uji" }], stockItems, supplyItems, paymentSources: sources, onSaved }),
        { wrapper }
      );
      act(() => result.current.changeKind("supply"));
      expect(result.current.kind.key).toBe("supply");
      let draft;
      act(() => {
        draft = result.current.createItem("Banner Baru");
      });
      act(() => {
        result.current.setForm((current) => ({ ...current, suplierId: 1 }));
        result.current.updateRow(result.current.rows[0].key, { stockItemId: draft.id, quantity: "1", unitPrice: "150000" });
        result.current.addRow();
      });
      act(() => {
        result.current.updateRow(result.current.rows[1].key, { stockItemId: 31, quantity: "2", unitPrice: "44000" });
      });

      await act(() => result.current.submit({ preventDefault() {} }));
      expect(api.saveSupplyPurchase).not.toHaveBeenCalled();

      act(() => result.current.updateRow(result.current.rows[0].key, { category: "Promosi" }));
      await act(() => result.current.addReceipts([photo("nota-banner.jpg")]));
      await act(() => result.current.submit({ preventDefault() {} }));

      const payload = api.saveSupplyPurchase.mock.calls[0][0];
      expect(payload).toMatchObject({
        suplierId: 1,
        paymentSourceId: 1,
        items: [
          { itemName: "Banner Baru", category: "Promosi", quantity: 1, unitPrice: 150000 },
          { supplyItemId: 31, quantity: 2, unitPrice: 22000 },
        ],
      });
      // The server takes each item's own unit (pcs for a new one).
      payload.items.forEach((item) => expect(item).not.toHaveProperty("unit"));
      expect(payload).not.toHaveProperty("kind");
      expect(api.savePurchase).not.toHaveBeenCalled();
      expect(api.uploadSupplyPurchaseAttachments).toHaveBeenCalledWith({
        purchaseId: 21,
        files: [expect.objectContaining({ name: "nota-banner.jpg" })],
      });
      expect(onSaved).toHaveBeenCalledWith("supply", "posted", "Promosi");
      expect(result.current.kind.key).toBe("raw");
    });
  });
});

describe("ringkasan and draft nota", () => {
  const draft = {
    id: 5,
    kind: "raw",
    date: "2026-10-30",
    suplierId: 1,
    supplierName: "Pasar Uji",
    paymentSourceId: 1,
    note: "tunggu acc",
    shippingCost: 10000,
    discountType: "percent",
    discountValue: 10,
    taxPercent: 11,
    total: 0,
    createdBy: "Kasir Uji",
    createdAt: "2026-10-30 08:00:00",
    items: [{ id: 50, stockItemId: 5, itemName: "Gula", quantity: 2000, unit: "gr", unitPrice: 15, total: 30000 }],
    attachments: [{ id: 9, url: "/api/shopping/purchase-attachments/9", name: "nota.jpg" }],
  };

  beforeEach(() => {
    api.getShoppingSuppliers.mockResolvedValue({ data: { data: [{ id: 1, name: "Pasar Uji" }] } });
    api.getPurchases.mockResolvedValue({ data: { data: { purchases: [], itemGroups, groupTotal: 1, total: 1 } } });
    api.getPaymentSources.mockResolvedValue({ data: { data: sources } });
  });

  it("adds ongkir, diskon and PPN into the Grand Total that leaves the saldo", async () => {
    renderShopping(true);
    fireEvent.click(await screen.findByRole("button", { name: "Tambah Belanja" }));
    const form = screen.getByRole("dialog");
    fireEvent.change(within(form).getByLabelText("Harga Total"), { target: { value: "100000" } });
    const summary = within(form).getByRole("region", { name: "Ringkasan nota" });
    expect(summary).toHaveTextContent("SubtotalRp 100.000");
    // Catatan and Bukti Nota come last: after the Ringkasan, before the save buttons.
    const follows = (first, second) => Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
    const note = within(form).getByLabelText("Catatan (opsional)");
    const camera = within(form).getByRole("button", { name: "Ambil Foto" });
    expect(follows(summary, note)).toBe(true);
    expect(follows(note, camera)).toBe(true);
    expect(follows(camera, within(form).getByRole("button", { name: "Simpan Draft" }))).toBe(true);

    fireEvent.change(within(summary).getByLabelText("Ongkos Kirim / Ekspedisi"), { target: { value: "15.000" } });
    expect(within(summary).getByLabelText("Ongkos Kirim / Ekspedisi")).toHaveValue("15.000");
    fireEvent.click(within(summary).getByRole("button", { name: "%" }));
    fireEvent.change(within(summary).getByLabelText("Diskon Nota"), { target: { value: "10" } });
    expect(summary).toHaveTextContent("-Rp 10.000");
    fireEvent.click(within(summary).getByLabelText("Supplier mengenakan PPN"));
    expect(within(summary).getByLabelText("PPN (%)")).toHaveValue("11");
    // 100.000 - 10.000 + 9.900 (11% of 90.000) + 15.000
    expect(within(summary).getByTestId("nota-grand-total")).toHaveTextContent("Rp 114.900");
    expect(within(form).getByTestId("payment-source-balance")).toHaveTextContent("setelah belanja -Rp 29.900");

    fireEvent.click(within(summary).getByRole("button", { name: "Rp" }));
    fireEvent.change(within(summary).getByLabelText("Diskon Nota"), { target: { value: "Rp 25.000" } });
    expect(within(summary).getByTestId("nota-grand-total")).toHaveTextContent("Rp 98.250");
  });

  it("saves a draft with its footer and a kasir cannot post", async () => {
    api.savePurchase.mockResolvedValue({ data: { data: { id: 7, total: 104500, status: "draft" } } });
    const onSaved = vi.fn();
    const { result } = renderHook(
      () => usePurchaseForm({ suppliers: [{ id: 1, name: "Pasar Uji" }], stockItems, paymentSources: sources, canPost: false, onSaved }),
      { wrapper: hookWrapper }
    );
    act(() => {
      result.current.setForm((current) => ({
        ...current,
        suplierId: 1,
        shippingCost: "5000",
        discountType: "amount",
        discountValue: "500",
        taxEnabled: true,
        taxPercent: "11",
      }));
      result.current.updateRow(result.current.rows[0].key, { stockItemId: 5, quantity: "2", unit: "gr", unitPrice: "90000" });
    });
    expect(result.current.totals).toEqual({ subtotal: 90000, discountAmount: 500, taxAmount: 9845, shippingCost: 5000, total: 104345 });

    await act(() => result.current.submit({ preventDefault() {} }));
    expect(api.savePurchase).not.toHaveBeenCalled();

    await act(() => result.current.saveDraft());
    expect(api.savePurchase.mock.calls[0][0]).toMatchObject({
      status: "draft",
      shippingCost: 5000,
      discountType: "amount",
      discountValue: 500,
      taxPercent: 11,
      items: [{ stockItemId: 5, quantity: 2, unit: "gr", unitPrice: 45000 }],
    });
    expect(api.savePurchase.mock.calls[0][0]).not.toHaveProperty("taxEnabled");
    expect(onSaved).toHaveBeenCalledWith("raw", "draft", "");
  });

  it("lists draft nota and lets an admin open, post or delete one", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    api.getPurchaseDrafts.mockResolvedValue({ data: { data: [draft] } });
    api.updatePurchaseDraft.mockResolvedValue({ data: { data: { id: 5, total: 40970, status: "posted" } } });
    api.deletePurchaseDraft.mockResolvedValue({ data: { data: { id: 5 } } });
    renderShopping(true);

    const panel = await screen.findByRole("region", { name: "Draft nota" });
    expect(panel).toHaveTextContent("Draft Nota Menunggu Posting (1)");
    const row = within(panel).getByText("Pasar Uji").closest("tr");
    expect(row).toHaveTextContent("Gula");
    expect(row).toHaveTextContent("Kasir Uji");
    expect(within(row).getByRole("button", { name: "Bukti (1)" })).toBeInTheDocument();

    fireEvent.click(within(row).getByRole("button", { name: "Periksa & Posting" }));
    const form = screen.getByRole("dialog", { name: "Draft Nota #5" });
    expect(form).toHaveTextContent("1 bukti tersimpan");
    expect(within(form).getByLabelText("Gramasi")).toHaveValue("2000");
    expect(within(form).getByLabelText("Harga Total")).toHaveValue("30.000");
    expect(within(form).getByLabelText("Ongkos Kirim / Ekspedisi")).toHaveValue("10.000");
    expect(within(form).getByLabelText("PPN (%)")).toHaveValue("11");
    expect(within(form).getByRole("button", { name: "Lainnya" })).toBeDisabled();
    // 30.000 - 3.000 + 2.970 + 10.000
    expect(within(form).getByTestId("nota-grand-total")).toHaveTextContent("Rp 39.970");

    fireEvent.click(within(form).getByRole("button", { name: "Simpan & Posting" }));
    await waitFor(() =>
      expect(api.updatePurchaseDraft.mock.calls[0][0]).toMatchObject({
        id: 5,
        status: "posted",
        suplierId: 1,
        paymentSourceId: 1,
        note: "tunggu acc",
        shippingCost: 10000,
        discountType: "percent",
        discountValue: 10,
        taxPercent: 11,
        items: [{ stockItemId: 5, quantity: 2000, unit: "gr", unitPrice: 15 }],
      })
    );
    expect(api.updatePurchaseDraft.mock.calls[0][0]).not.toHaveProperty("requestId");
    expect(api.savePurchase).not.toHaveBeenCalled();

    fireEvent.click(within(screen.getByRole("region", { name: "Draft nota" })).getByRole("button", { name: "Hapus" }));
    expect(window.confirm).toHaveBeenCalledWith("Hapus draft nota #5 dari Pasar Uji?");
    await waitFor(() => expect(api.deletePurchaseDraft.mock.calls[0][0]).toBe(5));
  });

  it("lets a kasir change a draft without posting it", async () => {
    api.getPurchaseDrafts.mockResolvedValue({ data: { data: [draft] } });
    renderShopping(false);
    const panel = await screen.findByRole("region", { name: "Draft nota" });
    expect(panel).toHaveTextContent("Admin akan memeriksa dan memposting.");
    fireEvent.click(within(panel).getByRole("button", { name: "Ubah" }));
    const form = screen.getByRole("dialog", { name: "Draft Nota #5" });
    expect(within(form).getByRole("button", { name: "Simpan Draft" })).toBeInTheDocument();
    expect(within(form).queryByRole("button", { name: "Simpan & Posting" })).not.toBeInTheDocument();
  });
});

describe("period filter and export", () => {
  const notaPage = (notas, totalSpending) => ({ data: { data: { notas, total: notas.length, totalSpending, page: 1 } } });
  const kinds = () => screen.getByRole("group", { name: "Riwayat jenis belanja" });

  beforeEach(() => {
    api.getShoppingSuppliers.mockResolvedValue({ data: { data: [] } });
    api.getPaymentSources.mockResolvedValue({ data: { data: sources } });
  });

  it("narrows the history from Hari Ini to a Custom Date picked on the calendar, but shows Peralatan for their whole lifetime", async () => {
    renderShopping();
    const select = await screen.findByLabelText("Periode");
    expect(select).toHaveValue("month");
    expect(Array.from(select.options, (option) => option.text)).toEqual([
      "Hari Ini",
      "Minggu Ini",
      "Bulan Ini",
      "Tahun Ini",
      "Semua Waktu",
      "Custom Date",
    ]);
    await waitFor(() => expect(api.getPurchaseNotas).toHaveBeenLastCalledWith({ search: "", page: 1, ...thisMonth }));
    expect(screen.getByRole("group", { name: "Filter periode" })).toHaveTextContent(`Bulan Ini (${rangeLabel(thisMonth)})`);

    fireEvent.change(select, { target: { value: "today" } });
    await waitFor(() => expect(api.getPurchaseNotas).toHaveBeenLastCalledWith({ search: "", page: 1, ...periodRange("today") }));
    fireEvent.change(select, { target: { value: "year" } });
    await waitFor(() => expect(api.getPurchaseNotas).toHaveBeenLastCalledWith({ search: "", page: 1, ...periodRange("year") }));
    fireEvent.change(select, { target: { value: "all" } });
    await waitFor(() => expect(api.getPurchaseNotas).toHaveBeenLastCalledWith({ search: "", page: 1 }));
    // Custom Date: the same calendar picker as the orders.
    fireEvent.change(select, { target: { value: "custom" } });
    fireEvent.click(screen.getByLabelText("Pilih rentang tanggal"));
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    await waitFor(() => expect(api.getPurchaseNotas).toHaveBeenLastCalledWith({ search: "", page: 1, ...periodRange("today") }));
    // Two days picked on the calendar, then Apply.
    fireEvent.click(screen.getByLabelText("Pilih rentang tanggal"));
    const pickDay = (number) => {
      const button = Array.from(document.querySelectorAll(".rdrDay:not(.rdrDayPassive)")).find(
        (dayButton) => dayButton.textContent === String(number)
      );
      fireEvent.mouseDown(button);
      fireEvent.mouseUp(button);
    };
    pickDay(10);
    pickDay(12);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    const picked = { from: thisMonth.from.replace(/-01$/, "-10"), to: thisMonth.from.replace(/-01$/, "-12") };
    await waitFor(() => expect(api.getPurchaseNotas).toHaveBeenLastCalledWith({ search: "", page: 1, ...picked }));
    expect(screen.getByLabelText("Pilih rentang tanggal").value).toMatch(/10, \d{4} - .*12, \d{4}/);

    // Peralatan are assets: lifetime, the period is off there.
    fireEvent.click(within(kinds()).getByRole("button", { name: "Peralatan" }));
    await waitFor(() => expect(api.getSupplyPurchaseNotas).toHaveBeenLastCalledWith({ search: "", page: 1, category: "Peralatan" }));
    expect(screen.getByLabelText("Periode")).toBeDisabled();
    expect(screen.getByText(/Peralatan adalah aset/)).toBeInTheDocument();
    fireEvent.click(within(kinds()).getByRole("button", { name: "Promosi" }));
    await waitFor(() =>
      expect(api.getSupplyPurchaseNotas).toHaveBeenLastCalledWith({ search: "", page: 1, category: "Promosi", ...picked })
    );
    expect(screen.getByLabelText("Periode")).toBeEnabled();
    // Reset clears the custom range: no limits.
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(api.getSupplyPurchaseNotas).toHaveBeenLastCalledWith({ search: "", page: 1, category: "Promosi" }));
  });

  it("exports every nota of the tab and period to Excel, laid out like the rekap sheet", async () => {
    api.getPurchaseNotas.mockResolvedValue(notaPage([postedNota(7), postedNota(8, { date: "2026-10-02" })], 222000));
    renderShopping();
    await screen.findByRole("rowgroup", { name: "Nota #7 Pasar Uji" });
    fireEvent.click(screen.getByRole("button", { name: "Export Excel" }));

    await waitFor(() => expect(XLSX.writeFile).toHaveBeenCalledTimes(1));
    expect(api.getPurchaseNotas).toHaveBeenLastCalledWith({ search: "", page: 1, pageSize: 500, ...thisMonth });
    const [workbook, fileName] = XLSX.writeFile.mock.calls[0];
    expect(fileName).toBe(`Belanja-Bahan-Baku-${thisMonth.from}_${thisMonth.to}.xlsx`);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "" });
    expect(rows[0][0]).toBe("REKAP PENGELUARAN - Bahan Baku");
    expect(rows[1][0]).toBe(`Periode: Bulan Ini (${rangeLabel(thisMonth)})`);
    expect(rows[3]).toEqual(["Tanggal", "Nota", "Toko", "Barang", "Sumber Pembayaran", "Gramasi", "Satuan", "Harga Satuan", "Jumlah"]);
    expect(rows.slice(4, 12)).toEqual([
      ["2026-09-15", "#7", "Pasar Uji", "Gula", "Kasir (Tunai)", 2000, "gr", 15, 30000],
      ["", "", "", "Kopi", "", 1, "kg", 50000, 50000],
      ["", "", "", "Teh", "", 500, "gr", 30, 15000],
      ["", "", "", "Susu", "", 1, "liter", 5000, 5000],
      ["", "", "", "Ongkir", "", 1, "", 10000, 10000],
      ["", "", "", "Diskon Nota (10%)", "", "", "", "", -10000],
      ["", "", "", "PPN 11%", "", "", "", "", 11000],
      ["", "", "", "Total", "", "", "", "", 111000],
    ]);
    expect(rows[12].slice(0, 3)).toEqual(["2026-10-02", "#8", "Pasar Uji"]);
    expect(rows.at(-1)).toEqual(["TOTAL PENGELUARAN", "", "", "2 nota", "", "", "", "", 222000]);
  });

  it("prints the same rekap for PDF, and says when the period has nothing to export", async () => {
    const printed = { document: { open: vi.fn(), write: vi.fn(), close: vi.fn() }, focus: vi.fn(), print: vi.fn(), close: vi.fn() };
    const open = vi.spyOn(window, "open").mockReturnValue(printed);
    api.getPurchaseNotas.mockResolvedValue(notaPage([postedNota(7)], 111000));
    renderShopping();
    await screen.findByRole("rowgroup", { name: "Nota #7 Pasar Uji" });
    fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));

    await waitFor(() => expect(printed.print).toHaveBeenCalledTimes(1));
    expect(open).toHaveBeenCalledWith("", "_blank");
    const html = printed.document.write.mock.calls.at(-1)[0];
    expect(html).toContain("<h1>REKAP PENGELUARAN - Bahan Baku</h1>");
    expect(html).toContain(`Periode: Bulan Ini (${rangeLabel(thisMonth)})`);
    expect(html).toContain("<td class=\"\">Gula</td>");
    expect(html).toContain("-Rp 10.000");
    expect(html).toContain("Rp 111.000");
    expect(html).toContain("TOTAL PENGELUARAN");

    api.getPurchaseNotas.mockResolvedValue(notaPage([], 0));
    fireEvent.change(screen.getByLabelText("Periode"), { target: { value: "today" } });
    fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));
    expect(await screen.findByText("Tidak ada nota untuk diexport pada periode ini.")).toBeInTheDocument();
    expect(printed.close).toHaveBeenCalled();
    expect(printed.print).toHaveBeenCalledTimes(1);
    open.mockRestore();
  });
});
