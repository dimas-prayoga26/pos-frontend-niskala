import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import $ from "jquery";
import * as api from "../../src/https/index";
import MenuManagement from "../../src/components/dashboard/MenuManagement";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  addCategory: vi.fn(),
  getCategories: vi.fn(),
  getMenuItems: vi.fn(),
  getSemiItems: vi.fn(),
  getStockItems: vi.fn(),
  updateMenuItem: vi.fn(),
}));

const asAdmin = { user: { _id: 1, name: "Admin", email: "a", phone: "1", role: "Admin", isAuth: true } };
const optionNames = (select) => Array.from(select.options).map((option) => option.textContent);
// Types into the open search of a select2 picker.
const searchIn = (select, term) =>
  act(() => {
    $(select).select2("open");
    $(document.querySelector(".select2-search__field")).val(term).trigger("input");
  });

describe("menu recipe editor", () => {
  beforeEach(() => {
    api.getCategories.mockResolvedValue({ data: { data: [{ id: 1, name: "Kopi", isActive: true }] } });
    api.getMenuItems.mockResolvedValue({ data: { data: [] } });
    api.getSemiItems.mockResolvedValue({ data: { data: [{ id: 5, name: "Nasi", unit: "porsi" }] } });
    api.getStockItems.mockResolvedValue({
      data: {
        data: [
          { id: 1, name: "Susu Segar", unit: "ml", isRecipeIngredient: true },
          { id: 2, name: "Aqua Galon", unit: "pcs", isRecipeIngredient: false },
          { id: 3, name: "Gula Lama", unit: "gr" },
        ],
      },
    });
  });

  it("picks bahan baku (bahan resep only) or bahan olahan per line", async () => {
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });

    await waitFor(() => expect(api.getStockItems).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole("button", { name: "Menu Items" }));
    fireEvent.click(await screen.findByRole("button", { name: "Tambah Menu" }));
    const recipeSection = screen.getByText("Komposisi Bahan").parentElement;
    fireEvent.click(within(recipeSection).getByRole("button", { name: "Tambah" }));

    const kinds = screen.getByRole("group", { name: "Jenis bahan" });
    expect(within(kinds).getByRole("button", { name: "Bahan Baku" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() =>
      expect(optionNames(screen.getByLabelText("Stok bahan"))).toEqual(["Pilih bahan baku", "Susu Segar", "Gula Lama"])
    );
    expect(screen.getByText(/hanya yang bertanda Bahan Resep/)).toBeInTheDocument();

    fireEvent.click(within(kinds).getByRole("button", { name: "Bahan Olahan" }));
    await waitFor(() =>
      expect(optionNames(screen.getByLabelText("Stok bahan"))).toEqual(["Pilih bahan olahan", "Nasi"])
    );
  });

  it("fills a bahan olahan in portions, never in gram", async () => {
    // Nasi: Rp 4.125 a portion; its old portion size is ignored.
    api.getSemiItems.mockResolvedValue({
      data: { data: [{ id: 5, name: "Nasi", unit: "porsi", portionSize: 150, averageCost: 4125 }] },
    });
    api.getMenuItems.mockResolvedValue({
      data: {
        data: [
          {
            id: 7,
            name: "Fried Egg Rice Bowl",
            categoryId: 1,
            regularPrice: 15000,
            isAvailable: true,
            imagePath: "/uploads/rice-bowl.jpg",
            ingredients: [{ semiItemId: 5, stockItemId: null, name: "Nasi", unit: "porsi", quantity: 1 }],
          },
        ],
      },
    });
    api.updateMenuItem.mockResolvedValue({ data: { success: true } });
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });

    await waitFor(() => expect(api.getSemiItems).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole("button", { name: "Menu Items" }));
    fireEvent.click(await screen.findByRole("button", { name: "Ubah" }));

    const quantity = await screen.findByLabelText("Jumlah bahan");
    expect(quantity).toHaveValue(1);
    expect(screen.getByLabelText("Satuan bahan")).toHaveValue("porsi");
    expect(screen.getByRole("button", { name: "Bahan Olahan" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText(/150 gr/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Cost bahan").value).toMatch(/^Rp\s4\.125$/);

    fireEvent.change(quantity, { target: { value: "1.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    await waitFor(() => expect(api.updateMenuItem).toHaveBeenCalled());
    expect(api.updateMenuItem.mock.calls[0][0].ingredients).toEqual([
      { stockItemId: null, semiItemId: 5, quantity: 1.5, note: "" },
    ]);
  });

  it("sends a bahan the recipe search does not find to Stok Bahan to be made", async () => {
    const onCreateIngredient = vi.fn();
    renderWithProviders(<MenuManagement onCreateIngredient={onCreateIngredient} />, { preloadedState: asAdmin });
    await waitFor(() => expect(api.getStockItems).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole("button", { name: "Menu Items" }));
    fireEvent.click(await screen.findByRole("button", { name: "Tambah Menu" }));
    const recipeSection = screen.getByText("Komposisi Bahan").parentElement;
    fireEvent.click(within(recipeSection).getByRole("button", { name: "Tambah" }));
    const picker = () => screen.getByLabelText("Stok bahan");
    await waitFor(() => expect(optionNames(picker())).toContain("Susu Segar"));

    // Not a Bahan Resep: it exists, so no Buat.
    searchIn(picker(), "Aqua Galon");
    expect(await screen.findByText("Aqua Galon bukan Bahan Resep. Aktifkan di Stok Bahan → Bahan Baku.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Buat Bahan Baku" })).not.toBeInTheDocument();

    searchIn(picker(), "Kemiri");
    expect(await screen.findByText('Bahan Baku "Kemiri" tidak ada.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Buat Bahan Baku" }));
    expect(onCreateIngredient).toHaveBeenLastCalledWith("raw", "Kemiri");

    fireEvent.click(within(screen.getByRole("group", { name: "Jenis bahan" })).getByRole("button", { name: "Bahan Olahan" }));
    await waitFor(() => expect(optionNames(picker())).toContain("Nasi"));
    searchIn(picker(), "Sambal");
    fireEvent.click(await screen.findByRole("button", { name: "Buat Bahan Olahan" }));
    expect(onCreateIngredient).toHaveBeenLastCalledWith("semi", "Sambal");
  });
});

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
    api.getSemiItems.mockResolvedValue({ data: { data: [] } });
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

  it("lists the Kategori Promo apart in the menu form", async () => {
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });

    fireEvent.click(await screen.findByRole("button", { name: "Menu Items" }));
    fireEvent.click(await screen.findByRole("button", { name: "Tambah Menu" }));
    const groupsOf = () =>
      screen
        .getAllByLabelText("Category")
        .flatMap((element) => Array.from(element.querySelectorAll("optgroup")));
    await waitFor(() =>
      expect(groupsOf().map((group) => [
        group.label,
        Array.from(group.children).map((option) => option.textContent),
      ])).toEqual([
        ["Category Menu", ["Kopi"]],
        ["Kategori Promo (isi dari menu yang sudah ada)", ["PROMO"]],
      ])
    );
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

  it("offers menus of every category in a choice and keeps one whose category was deleted", async () => {
    api.updateMenuItem.mockResolvedValue({ data: { success: true } });
    api.getCategories.mockResolvedValue({
      data: {
        data: [
          { id: 1, name: "Kopi", isActive: true },
          { id: 2, name: "PROMO", isActive: true, isBundle: true },
          { id: 3, name: "Black Coffee", isActive: true },
          { id: 4, name: "White Coffee", isActive: true },
        ],
      },
    });
    api.getMenuItems.mockResolvedValue({
      data: {
        data: [
          menu(7, "Kopi Susu", 18000, 6000),
          menu(11, "Americano", 15000, 3000, { categoryId: 3 }),
          menu(12, "Cafe Latte", 20000, 5000, { categoryId: 4 }),
          menu(30, "Siang Kenyang", 35000, 0, {
            categoryId: 2,
            isBundle: true,
            bundleChoices: [
              { id: 15, categoryId: null, label: "Coffee", categoryName: "Coffee", quantity: 1, menuItemIds: [11] },
            ],
          }),
        ],
      },
    });
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });

    fireEvent.click(await screen.findByRole("button", { name: "Menu Items" }));
    fireEvent.click(
      within((await screen.findByText("Siang Kenyang")).closest("tr")).getByRole("button", { name: "Ubah" })
    );

    // The category Coffee is gone; the choice keeps its name and menus.
    expect(await screen.findByText("Pilihan Coffee")).toBeInTheDocument();
    expect(screen.getByLabelText("Nama Pilihan Coffee")).toHaveValue("Coffee");
    // Its menus can come from any ordinary category, grouped per category.
    const choicePicker = screen.getByLabelText("Tambah menu ke Pilihan Coffee");
    expect(optionNames(choicePicker)).toEqual(["Pilih menu", "Kopi Susu", "Cafe Latte"]);
    expect(Array.from(choicePicker.querySelectorAll("optgroup")).map((group) => group.label)).toEqual([
      "Kopi",
      "White Coffee",
    ]);
    $(choicePicker).val("12").trigger($.Event("select2:select", { params: { data: { id: "12", text: "Cafe Latte" } } }));
    expect(await screen.findByRole("button", { name: "Hapus Cafe Latte dari Pilihan Coffee" })).toBeInTheDocument();

    // Left blank it keeps its name; a new one renames it.
    fireEvent.change(screen.getByLabelText("Nama Pilihan Coffee"), { target: { value: " " } });
    expect(screen.getByText("Pilihan Coffee")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nama Pilihan Coffee"), { target: { value: "Kopi Siang" } });
    expect(screen.getByText("Pilihan Kopi Siang")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    await waitFor(() => expect(api.updateMenuItem).toHaveBeenCalled());
    expect(api.updateMenuItem.mock.calls[0][0].bundleChoices).toEqual([
      { categoryId: null, label: "Kopi Siang", quantity: 1, menuItemIds: [11, 12] },
    ]);
  });

  it("shows each menu's profit as a percent of its price", async () => {
    api.getMenuItems.mockResolvedValue({
      data: {
        data: [
          menu(7, "Americano", 15000, 2556, { grossProfit: 12444 }),
          menu(8, "Rugi", 10000, 12000, { grossProfit: -2000 }),
          menu(9, "Gratis", 0, 0, { grossProfit: 0 }),
        ],
      },
    });
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });

    fireEvent.click(await screen.findByRole("button", { name: "Menu Items" }));
    expect(await screen.findByRole("columnheader", { name: "Persentase Keuntungan" })).toBeInTheDocument();
    const percentOf = (name) => {
      const cells = within(screen.getByText(name).closest("tr")).getAllByRole("cell");
      return cells[7].textContent;
    };
    // (15.000 - 2.556) / 15.000
    expect(percentOf("Americano")).toBe("83%");
    expect(percentOf("Rugi")).toBe("-20%");
    expect(percentOf("Gratis")).toBe("-");
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
