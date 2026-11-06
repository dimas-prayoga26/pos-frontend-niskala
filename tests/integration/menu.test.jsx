import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import $ from "jquery";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import MenuManagement from "../../src/components/dashboard/MenuManagement";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  addCategory: vi.fn(),
  getCategories: vi.fn(),
  getMenuItems: vi.fn(),
  getStockItems: vi.fn(),
  updateMenuItem: vi.fn(),
}));

const asAdmin = { user: { _id: 1, name: "Admin", email: "a", phone: "1", role: "Admin", isAuth: true } };
const optionNames = (select) => Array.from(select.options).map((option) => option.textContent);

describe("kategori promo", () => {
  const menu = (id, name, regularPrice, hppCost, extra = {}) => ({
    id,
    name,
    categoryId: 1,
    regularPrice,
    hppCost,
    isAvailable: true,
    imagePath: `/uploads/${id}.jpg`,
    ingredients: [],
    bundleItems: [],
    ...extra,
  });

  beforeEach(() => {
    api.getCategories.mockResolvedValue({
      data: {
        data: [
          { id: 1, name: "Kopi", isActive: true },
          { id: 2, name: "PROMO", isActive: true, isBundle: true },
        ],
      },
    });
    api.getMenuItems.mockResolvedValue({
      data: {
        data: [
          menu(7, "Kopi Susu", 18000, 6000),
          menu(8, "Croissant", 15000, 5400),
          menu(9, "Teh", 10000, 2000),
          menu(10, "Roti Baru", 12000, 3000, { isAvailable: false }),
          menu(20, "Paket Hemat", 28000, 0, {
            categoryId: 2,
            isBundle: true,
            grossProfit: 16600,
            bundleItems: [
              { menuItemId: 7, name: "Kopi Susu", quantity: 1 },
              { menuItemId: 8, name: "Croissant", quantity: 1 },
            ],
          }),
        ],
      },
    });
    api.getStockItems.mockResolvedValue({ data: { data: [] } });
  });

  it("marks a category as Kategori Promo", async () => {
    api.addCategory.mockResolvedValue({ data: { success: true } });
    api.getCategories.mockResolvedValue({
      data: {
        data: [
          { id: 2, name: "PROMO", isActive: true, isBundle: true },
          { id: 3, name: "Spesial", isActive: true, isBundle: true },
        ],
      },
    });
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });

    // The list labels a Kategori Promo, unless its name already says Promo.
    const rowOf = async (name) =>
      (await screen.findAllByText(name)).map((cell) => cell.closest("tr")).find(Boolean);
    expect(within(await rowOf("Spesial")).getByText("Promo")).toBeInTheDocument();
    expect(within(await rowOf("PROMO")).queryByText("Promo")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tambah Category" }));
    fireEvent.change(screen.getByPlaceholderText("Coffee"), { target: { value: "PAKET" } });
    fireEvent.click(screen.getByLabelText("Kategori Promo"));
    fireEvent.click(screen.getByRole("button", { name: "Tambah" }));

    await waitFor(() => expect(api.addCategory).toHaveBeenCalled());
    expect(api.addCategory.mock.calls[0][0]).toMatchObject({ name: "PAKET", isBundle: true });
  });

  it("fills a promo menu with menus instead of bahan", async () => {
    api.updateMenuItem.mockResolvedValue({ data: { success: true } });
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });

    fireEvent.click(await screen.findByRole("button", { name: "Menu Items" }));
    expect(await screen.findByText("1× Kopi Susu · 1× Croissant")).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByText("Paket Hemat").closest("tr")).getByRole("button", { name: "Ubah" })
    );

    expect(screen.queryByText("Komposisi Bahan")).not.toBeInTheDocument();
    expect(screen.getByText("Isi Paket")).toBeInTheDocument();
    expect(screen.getByLabelText("Harga")).toHaveValue("28000");
    // Choices of ordinary categories, then ordinary menus not in the package yet.
    const picker = screen.getByLabelText("Tambah menu paket");
    await waitFor(() =>
      expect(optionNames(picker)).toEqual(["Pilih menu", "Pilihan Kopi", "Teh", "Roti Baru (tidak tersedia)"])
    );
    expect(screen.queryByText("Harga normal")).not.toBeInTheDocument();
    // No HPP in the form (each sale counts its menus); the profit is typed in.
    expect(screen.queryByText("HPP paket")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Gross Profit")).toHaveValue("16600");

    $(picker).val("9").trigger($.Event("select2:select", { params: { data: { id: "9", text: "Teh" } } }));
    expect(await screen.findByRole("button", { name: "Hapus Teh" })).toBeInTheDocument();
    // Each menu counts once: no quantity input.
    expect(screen.queryByLabelText(/^Jumlah /)).not.toBeInTheDocument();
    // An unavailable menu hides the package from the POS, so its line says so.
    $(picker).val("10").trigger($.Event("select2:select", { params: { data: { id: "10", text: "Roti Baru" } } }));
    expect(await screen.findByText("Tidak tersedia")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hapus Roti Baru" }));
    expect(screen.queryByText("Tidak tersedia")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hapus Croissant" }));

    // A choice of Kopi: the cashier picks the menu when ordering.
    $(picker)
      .val("category:1")
      .trigger($.Event("select2:select", { params: { data: { id: "category:1", text: "Pilihan Kopi" } } }));
    // A new choice starts empty; its Kopi menus are picked one by one (the
    // cashier will only see those). No HPP sum is shown.
    const choicePicker = await screen.findByLabelText("Tambah menu ke Pilihan Kopi");
    expect(screen.queryByText(/^HPP Rp/)).not.toBeInTheDocument();
    expect(optionNames(choicePicker)).toEqual([
      "Pilih menu",
      "Kopi Susu",
      "Croissant",
      "Teh",
      "Roti Baru (tidak tersedia)",
    ]);
    const addToChoice = (id, text) =>
      $(screen.getByLabelText("Tambah menu ke Pilihan Kopi"))
        .val(id)
        .trigger($.Event("select2:select", { params: { data: { id, text } } }));
    addToChoice("7", "Kopi Susu");
    addToChoice("9", "Teh");
    addToChoice("8", "Croissant");
    await waitFor(() =>
      expect(optionNames(screen.getByLabelText("Tambah menu ke Pilihan Kopi"))).toEqual([
        "Pilih menu",
        "Roti Baru (tidak tersedia)",
      ])
    );
    fireEvent.click(screen.getByRole("button", { name: "Hapus Croissant dari Pilihan Kopi" }));
    expect(
      screen.queryByRole("button", { name: "Hapus Croissant dari Pilihan Kopi" })
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Gross Profit"), { target: { value: "12000" } });

    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    await waitFor(() => expect(api.updateMenuItem).toHaveBeenCalled());
    expect(api.updateMenuItem.mock.calls[0][0]).toMatchObject({
      menuItemId: 20,
      categoryId: "2",
      ingredients: [],
      bundleItems: [
        { menuItemId: 7, quantity: 1 },
        { menuItemId: 9, quantity: 1 },
      ],
      bundleChoices: [{ categoryId: 1, quantity: 1, menuItemIds: [7, 9] }],
      hppCost: 0,
      grossProfit: 12000,
    });
  });

  it("keeps a promo's price and a discount percent off it", async () => {
    api.updateMenuItem.mockResolvedValue({ data: { success: true } });
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });

    fireEvent.click(await screen.findByRole("button", { name: "Menu Items" }));
    fireEvent.click(
      within((await screen.findByText("Paket Hemat")).closest("tr")).getByRole("button", { name: "Ubah" })
    );

    fireEvent.change(screen.getByLabelText("Harga"), { target: { value: "18000" } });
    fireEvent.change(screen.getByLabelText("Diskon (%)"), { target: { value: "100" } });
    expect(screen.getByLabelText("Harga")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    await waitFor(() => expect(api.updateMenuItem).toHaveBeenCalled());
    expect(api.updateMenuItem.mock.calls[0][0]).toMatchObject({
      menuItemId: 20,
      regularPrice: 18000,
      discountPercent: 100,
    });
  });

  it("works out a discount promo's gross profit from its price and its menus' HPP", async () => {
    api.updateMenuItem.mockResolvedValue({ data: { success: true } });
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });

    fireEvent.click(await screen.findByRole("button", { name: "Menu Items" }));
    fireEvent.click(
      within((await screen.findByText("Paket Hemat")).closest("tr")).getByRole("button", { name: "Ubah" })
    );
    // Without a discount the profit is typed in.
    expect(screen.getByLabelText("Gross Profit")).toBeEnabled();

    // Rp 15.000 less 80% = Rp 3.000, less the HPP of Kopi Susu (6.000) and Croissant (5.400).
    fireEvent.change(screen.getByLabelText("Harga"), { target: { value: "15000" } });
    fireEvent.change(screen.getByLabelText("Diskon (%)"), { target: { value: "80" } });
    const grossProfit = screen.getByLabelText("Gross Profit");
    expect(grossProfit).toBeDisabled();
    expect(grossProfit).toHaveValue("-8.400");

    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    await waitFor(() => expect(api.updateMenuItem).toHaveBeenCalled());
    expect(api.updateMenuItem.mock.calls[0][0]).toMatchObject({
      regularPrice: 15000,
      discountPercent: 80,
      grossProfit: -8400,
    });
  });

  it("rejects a discount above 100%", async () => {
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });

    fireEvent.click(await screen.findByRole("button", { name: "Menu Items" }));
    fireEvent.click(
      within((await screen.findByText("Paket Hemat")).closest("tr")).getByRole("button", { name: "Ubah" })
    );
    fireEvent.change(screen.getByLabelText("Diskon (%)"), { target: { value: "120" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

    expect(await screen.findByText("Diskon harus 0-100%.")).toBeInTheDocument();
    expect(api.updateMenuItem).not.toHaveBeenCalled();
  });

  it("needs at least one menu in a package", async () => {
    api.updateMenuItem.mockResolvedValue({ data: { success: true } });
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });

    fireEvent.click(await screen.findByRole("button", { name: "Menu Items" }));
    fireEvent.click(
      within((await screen.findByText("Paket Hemat")).closest("tr")).getByRole("button", { name: "Ubah" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Hapus Croissant" }));
    fireEvent.click(screen.getByRole("button", { name: "Hapus Kopi Susu" }));
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

    expect(await screen.findByText("Paket minimal berisi 1 menu.")).toBeInTheDocument();
    expect(api.updateMenuItem).not.toHaveBeenCalled();
  });

  it("saves a package of a single menu", async () => {
    api.updateMenuItem.mockResolvedValue({ data: { success: true } });
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });

    fireEvent.click(await screen.findByRole("button", { name: "Menu Items" }));
    fireEvent.click(
      within((await screen.findByText("Paket Hemat")).closest("tr")).getByRole("button", { name: "Ubah" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Hapus Croissant" }));
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

    await waitFor(() => expect(api.updateMenuItem).toHaveBeenCalled());
    expect(api.updateMenuItem.mock.calls[0][0]).toMatchObject({
      bundleItems: [{ menuItemId: 7, quantity: 1 }],
    });
  });
});
