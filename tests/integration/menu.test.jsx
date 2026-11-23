import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import $ from "jquery";
import * as api from "../../src/https/index";
import MenuManagement from "../../src/components/dashboard/MenuManagement";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  // Pengaturan → API: the loyalty key is set (a test may answer otherwise).
  getIntegrationStatus: vi.fn(async () => ({ data: { success: true, data: { loyalty: true } } })),
  addCategory: vi.fn(),
  deleteMenuItem: vi.fn(),
  getCategories: vi.fn(),
  getMenuItems: vi.fn(),
  getSemiItems: vi.fn(),
  getStockItems: vi.fn(),
  getMenuItemSales: vi.fn(),
  setMenuItemAvailability: vi.fn(),
  updateCategoryPositions: vi.fn(),
  updateMenuItem: vi.fn(),
  updateLoyaltyReward: vi.fn(),
  // Pengaturan → Stamp Card: its rewards, each giving a Hadiah Stamp Card menu.
  getLoyaltyProgram: vi.fn(async () => ({
    data: {
      data: {
        active: true,
        rewards: [
          { id: 1, stamps: 5, label: "Minuman gratis", active: true },
          { id: 2, stamps: 10, label: "Makanan gratis", active: true },
        ],
      },
    },
  })),
}));

const asAdmin = { user: { _id: 1, name: "Admin", email: "a", phone: "1", role: "Admin", isAuth: true } };
const optionNames = (select) => Array.from(select.options).map((option) => option.textContent);
// Picks more menus in a box's multiple select (its tags).
const pickMenus = (boxName, ...ids) => {
  const select = screen.getByLabelText(`Menu ${boxName}`);
  $(select).val([...($(select).val() || []), ...ids]).trigger("change");
};
const plainText = (texts) => texts.map((text) => text.replace(/\s/g, " "));
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

describe("menu delete", () => {
  beforeEach(() => {
    api.getCategories.mockResolvedValue({ data: { data: [{ id: 1, name: "Kopi", isActive: true }] } });
    api.getMenuItems.mockResolvedValue({
      data: { data: [{ id: 7, name: "Kopi Susu", categoryId: 1, regularPrice: 18000, isAvailable: true }] },
    });
    api.getSemiItems.mockResolvedValue({ data: { data: [] } });
    api.getStockItems.mockResolvedValue({ data: { data: [] } });
    api.deleteMenuItem.mockResolvedValue({ data: { success: true } });
  });

  it("asks before deleting a menu", async () => {
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });

    fireEvent.click(await screen.findByRole("button", { name: "Menu Items" }));
    const row = (await screen.findByText("Kopi Susu")).closest("tr");

    fireEvent.click(within(row).getByRole("button", { name: "Hapus" }));
    const dialog = screen.getByRole("dialog", { name: "Hapus menu?" });
    expect(dialog).toHaveTextContent("Kopi Susu akan dihapus permanen.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Batal" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.deleteMenuItem).not.toHaveBeenCalled();

    fireEvent.click(within(row).getByRole("button", { name: "Hapus" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Hapus" }));
    await waitFor(() => expect(api.deleteMenuItem).toHaveBeenCalled());
    expect(api.deleteMenuItem.mock.calls[0][0]).toBe(7);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("categories", () => {
  beforeEach(() => {
    api.getMenuItems.mockResolvedValue({ data: { data: [] } });
    api.getStockItems.mockResolvedValue({ data: { data: [] } });
    api.getSemiItems.mockResolvedValue({ data: { data: [] } });
    api.getCategories.mockResolvedValue({
      data: {
        data: [
          { id: 1, name: "Kopi", isActive: true },
          { id: 9, name: "Lama", isActive: false },
          { id: 2, name: "Snack", isActive: true },
        ],
      },
    });
    api.updateCategoryPositions.mockReset().mockResolvedValue({ data: { success: true } });
  });

  it("opens Menu Items first, then lists the categories in one table: POS order, inactive last, dragged to move", async () => {
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });

    expect(screen.getByRole("button", { name: "Menu Items" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Categories" }));

    expect(screen.queryByText("Position Categories")).not.toBeInTheDocument();
    const rowOf = (name) => screen.getByText(name).closest("tr");
    await screen.findByText("Snack");
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows.map((row) => [row.cells[0].textContent, row.cells[2].textContent])).toEqual([
      ["⋮⋮1", "Kopi"],
      ["⋮⋮2", "Snack"],
      ["-", "Lama"],
    ]);
    expect(rowOf("Lama")).not.toHaveAttribute("draggable", "true");

    fireEvent.dragStart(rowOf("Snack"));
    fireEvent.dragOver(rowOf("Kopi"));
    fireEvent.drop(rowOf("Kopi"));

    await waitFor(() => expect(api.updateCategoryPositions).toHaveBeenCalled());
    expect(api.updateCategoryPositions.mock.calls[0][0]).toEqual(["2", "1", "9"]);
  });

  it("doesn't drag while searching", async () => {
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });
    fireEvent.click(screen.getByRole("button", { name: "Categories" }));
    await screen.findByText("Snack");

    fireEvent.change(screen.getByPlaceholderText("Search category"), { target: { value: "o" } });
    expect(screen.getByText("Kopi").closest("tr")).not.toHaveAttribute("draggable", "true");
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
    fireEvent.click(screen.getByRole("button", { name: "Categories" }));

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

  it("keeps menus in Menu Items and promos in Promo, each made from its own tab", async () => {
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });
    const categoryNames = () =>
      Array.from(screen.getAllByLabelText("Category")[0].options).map((option) => option.textContent);
    const listed = (name) => screen.queryByText(name);

    // Menu Items: the menus sold, made in a Category Menu only.
    expect(await screen.findByText("Kopi Susu")).toBeInTheDocument();
    expect(listed("Paket Hemat")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tambah Menu" }));
    await waitFor(() => expect(categoryNames()).toEqual(["Pilih category", "Kopi"]));
    fireEvent.click(screen.getByRole("button", { name: "Tutup" }));

    // Promo: a card per Kategori Promo menu, no table; Tambah Promo picks
    // PROMO and starts a box.
    fireEvent.click(screen.getByRole("button", { name: "Promo" }));
    const card = await screen.findByRole("region", { name: "Paket Hemat" });
    expect(within(card).getByText("Rp 28.000")).toBeInTheDocument();
    expect(within(card).getByText("1× Kopi Susu · 1× Croissant")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Ubah" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(listed("Kopi Susu")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tambah Promo" }));
    expect(screen.getByRole("heading", { name: "Tambah Promo" })).toBeInTheDocument();
    await waitFor(() => expect(categoryNames()).toEqual(["Pilih kategori promo", "PROMO"]));
    expect(screen.getAllByLabelText("Category")[0]).toHaveValue("2");
    expect(screen.getByText("Isi Paket")).toBeInTheDocument();
  });

  it("fills a promo with boxes: one menu always goes in, of several the cashier picks one", async () => {
    api.updateMenuItem.mockResolvedValue({ data: { success: true } });
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });

    fireEvent.click(await screen.findByRole("button", { name: "Promo" }));
    expect(await screen.findByText("1× Kopi Susu · 1× Croissant")).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByText("Paket Hemat").closest("section")).getByRole("button", { name: "Ubah" })
    );

    expect(screen.queryByText("Komposisi Bahan")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Harga")).toHaveValue("28000");
    // No Jenis Paket and no list picker: only boxes.
    expect(screen.queryByRole("group", { name: "Jenis paket" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Tambah menu paket")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Gross Profit")).toHaveValue("16600");

    // Its two fixed menus: a box each, named after the menu, always in.
    const boxOf = (name) => screen.getByRole("button", { name: `Hapus Pilihan ${name}` }).closest("div.rounded-lg");
    expect(within(boxOf("Kopi Susu")).getByText("1 menu: selalu ikut, kasir tidak memilih.")).toBeInTheDocument();
    expect(within(boxOf("Croissant")).getByText("1 menu: selalu ikut, kasir tidak memilih.")).toBeInTheDocument();
    expect(within(boxOf("Kopi Susu")).queryByText(/^HPP Rp/)).not.toBeInTheDocument();

    // Teh in the Kopi Susu box: the cashier picks Kopi Susu or Teh.
    pickMenus("Pilihan Kopi Susu", "9");
    expect(await screen.findByText("Pilihan Kopi")).toBeInTheDocument();
    expect(within(boxOf("Kopi")).getByText("Kasir pilih 1 dari 2 menu.")).toBeInTheDocument();

    // A new box starts empty, its multiple select offering ordinary menus of
    // every category with their HPP; an unavailable menu hides the package
    // from the POS, so its box says so.
    fireEvent.click(screen.getByRole("button", { name: "+ Tambah Pilihan" }));
    const thirdPicker = await screen.findByLabelText("Menu Pilihan 3");
    expect($(thirdPicker).val()).toEqual([]);
    expect(plainText(optionNames(thirdPicker))).toEqual([
      "Kopi Susu · Rp 6.000",
      "Croissant · Rp 5.400",
      "Teh · Rp 2.000",
      "Roti Baru (tidak tersedia) · Rp 3.000",
    ]);
    pickMenus("Pilihan 3", "10");
    expect(await screen.findByText("Tidak tersedia")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hapus Pilihan Roti Baru" }));
    expect(screen.queryByText("Tidak tersedia")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Gross Profit"), { target: { value: "12000" } });

    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    await waitFor(() => expect(api.updateMenuItem).toHaveBeenCalled());
    expect(api.updateMenuItem.mock.calls[0][0]).toMatchObject({
      menuItemId: 20,
      categoryId: "2",
      ingredients: [],
      bundleItems: [{ menuItemId: 8, quantity: 1 }],
      bundleChoices: [{ categoryId: null, label: "Kopi", quantity: 1, menuItemIds: [7, 9] }],
      hppCost: 0,
      grossProfit: 12000,
    });
  });

  it("opens a promo's choice as a box and keeps its category", async () => {
    api.updateMenuItem.mockResolvedValue({ data: { success: true } });
    api.getMenuItems.mockResolvedValue({
      data: {
        data: [
          menu(7, "Kopi Susu", 18000, 6000),
          menu(9, "Teh", 10000, 2000),
          menu(21, "Pilih Kopi", 20000, 0, {
            categoryId: 2,
            isBundle: true,
            bundleChoices: [{ id: 16, categoryId: 1, label: null, categoryName: "Kopi", quantity: 1, menuItemIds: [7, 9] }],
          }),
        ],
      },
    });
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });

    fireEvent.click(await screen.findByRole("button", { name: "Promo" }));
    fireEvent.click(
      within((await screen.findByText("Pilih Kopi")).closest("section")).getByRole("button", { name: "Ubah" })
    );

    expect(screen.getByText("Pilihan Kopi")).toBeInTheDocument();
    expect(screen.getByText("Kasir pilih 1 dari 2 menu.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    await waitFor(() => expect(api.updateMenuItem).toHaveBeenCalled());
    expect(api.updateMenuItem.mock.calls[0][0]).toMatchObject({
      bundleItems: [],
      bundleChoices: [{ categoryId: 1, label: null, quantity: 1, menuItemIds: [7, 9] }],
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
            bundleItems: [{ menuItemId: 7, name: "Kopi Susu", quantity: 1 }],
            bundleChoices: [
              { id: 15, categoryId: null, label: "Coffee", categoryName: "Coffee", quantity: 1, menuItemIds: [11] },
            ],
          }),
        ],
      },
    });
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });

    fireEvent.click(await screen.findByRole("button", { name: "Promo" }));
    fireEvent.click(
      within((await screen.findByText("Siang Kenyang")).closest("section")).getByRole("button", { name: "Ubah" })
    );

    // Its fixed menu is a box of that one menu.
    expect(screen.getByText("Pilihan Kopi Susu")).toBeInTheDocument();
    // The category Coffee is gone; the choice keeps its name and menus.
    expect(await screen.findByText("Pilihan Coffee")).toBeInTheDocument();
    expect(screen.getByLabelText("Nama Pilihan Coffee")).toHaveValue("Coffee");
    // Its menus can come from any ordinary category, grouped per category.
    const choicePicker = screen.getByLabelText("Menu Pilihan Coffee");
    expect($(choicePicker).val()).toEqual(["11"]);
    expect(plainText(optionNames(choicePicker))).toEqual([
      "Kopi Susu · Rp 6.000",
      "Americano · Rp 3.000",
      "Cafe Latte · Rp 5.000",
    ]);
    expect(Array.from(choicePicker.querySelectorAll("optgroup")).map((group) => group.label)).toEqual([
      "Kopi",
      "Black Coffee",
      "White Coffee",
    ]);
    pickMenus("Pilihan Coffee", "12");
    expect(await screen.findByText("Kasir pilih 1 dari 2 menu.")).toBeInTheDocument();

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
    expect(api.updateMenuItem.mock.calls[0][0].bundleItems).toEqual([{ menuItemId: 7, quantity: 1 }]);
  });

  it("shows the HPP of a menu with each pengganti of its bahan olahan under its HPP", async () => {
    api.getMenuItems.mockResolvedValue({
      data: {
        data: [
          menu(7, "Rice Bowl Ayam", 25000, 4000, {
            grossProfit: 21000,
            ingredientChoices: [{
              semiItemId: 5,
              name: "Nasi Putih",
              quantity: 1,
              unit: "porsi",
              options: [{ semiItemId: 6, name: "Nasi Daun Jeruk", extraPrice: 2000, hppCost: 4100 }],
            }],
          }),
        ],
      },
    });
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });

    fireEvent.click(await screen.findByRole("button", { name: "Menu Items" }));
    const hppCell = within((await screen.findByText("Rice Bowl Ayam")).closest("tr")).getAllByRole("cell")[5];
    expect(hppCell.textContent.replace(/\s/g, " ")).toBe("Rp 4.000Nasi Daun Jeruk: Rp 4.100");
  });

  it("shows each menu's persentase: its price over the HPP plus 30%", async () => {
    api.getMenuItems.mockResolvedValue({
      data: {
        data: [
          menu(7, "Americano", 15000, 2556, { grossProfit: 12444 }),
          menu(8, "Rugi", 10000, 12000, { grossProfit: -2000 }),
          menu(9, "Gratis", 0, 0, { grossProfit: 0 }),
          menu(10, "Tanpa Resep", 12000, 0, { grossProfit: 12000 }),
          menu(20, "Paket", 28000, 0, { categoryId: 2, isBundle: true, grossProfit: 16600 }),
        ],
      },
    });
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });

    fireEvent.click(await screen.findByRole("button", { name: "Menu Items" }));
    expect(await screen.findByRole("columnheader", { name: "Persentase Keuntungan" })).toBeInTheDocument();
    const factorOf = (name) => {
      const cells = within(screen.getByText(name).closest("tr")).getAllByRole("cell");
      return cells[7].textContent;
    };
    // 15.000 / (2.556 x 1,3), as the COGS sheet writes it.
    expect(factorOf("Americano")).toBe("451%");
    // Below 100%: the price does not cover the HPP plus 30%.
    expect(factorOf("Rugi")).toBe("64%");
    // No price or no HPP: nothing to show.
    expect(factorOf("Gratis")).toBe("-");
    expect(factorOf("Tanpa Resep")).toBe("-");
    // A package is listed in Promo, not here.
    expect(screen.queryByText("Paket")).not.toBeInTheDocument();
  });

  it("keeps a promo's price and a discount percent off it", async () => {
    api.updateMenuItem.mockResolvedValue({ data: { success: true } });
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });

    fireEvent.click(await screen.findByRole("button", { name: "Promo" }));
    fireEvent.click(
      within((await screen.findByText("Paket Hemat")).closest("section")).getByRole("button", { name: "Ubah" })
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

    fireEvent.click(await screen.findByRole("button", { name: "Promo" }));
    fireEvent.click(
      within((await screen.findByText("Paket Hemat")).closest("section")).getByRole("button", { name: "Ubah" })
    );
    // Without a discount the profit is typed in.
    expect(screen.getByLabelText("Gross Profit")).toBeEnabled();

    // Rp 15.000 less 80% = Rp 3.000, less the HPP of Kopi Susu (6.000) and
    // Croissant (5.400), both always in.
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

  it("sets a promo as Hadiah Stamp Card and picks its reward in the same form", async () => {
    api.updateMenuItem.mockResolvedValue({ data: { success: true } });
    api.updateLoyaltyReward.mockReset().mockResolvedValue({ data: { success: true } });
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });

    fireEvent.click(await screen.findByRole("button", { name: "Promo" }));
    fireEvent.click(
      within((await screen.findByText("Paket Hemat")).closest("section")).getByRole("button", { name: "Ubah" })
    );

    // A dropdown: Paket biasa or Hadiah Stamp Card (through Pengaturan → API).
    const kind = screen.getByLabelText("Jenis promo");
    expect(optionNames(kind)).toEqual(["Paket biasa", "Hadiah Stamp Card (API)"]);
    expect(kind).toHaveValue("paket");
    expect(screen.queryByLabelText("Hadiah Stamp Card")).not.toBeInTheDocument();

    fireEvent.change(kind, { target: { value: "loyalty" } });
    expect(kind).toHaveValue("loyalty");
    expect(screen.getByLabelText("Harga")).toHaveValue("0");
    expect(screen.getByLabelText("Diskon (%)")).toHaveValue("100");
    // Given away: 0, not minus its menus' HPP (each Tukar records that).
    expect(screen.getByLabelText("Gross Profit")).toHaveValue("0");

    const reward = screen.getByLabelText("Hadiah Stamp Card");
    expect(optionNames(reward)).toEqual(["Pilih hadiah", "Stamp ke-5 · Minuman gratis", "Stamp ke-10 · Makanan gratis"]);
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    expect(await screen.findByText("Pilih hadiah Stamp Card-nya.")).toBeInTheDocument();
    expect(api.updateMenuItem).not.toHaveBeenCalled();

    fireEvent.change(reward, { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    await waitFor(() => expect(api.updateLoyaltyReward).toHaveBeenCalledWith({ id: 1, promoMenuItemId: 20 }));
    expect(api.updateMenuItem.mock.calls[0][0]).toMatchObject({
      menuItemId: 20,
      regularPrice: 0,
      discountPercent: 100,
      isLoyaltyPromo: true,
      grossProfit: 0,
    });
    expect(api.updateMenuItem.mock.calls[0][0]).not.toHaveProperty("loyaltyRewardId");
    expect(api.updateLoyaltyReward).toHaveBeenCalledTimes(1);
  });

  describe("a Hadiah Stamp Card already giving stamp 5", () => {
    const freePromo = (id, name, menuItemId) =>
      menu(id, name, 0, 0, {
        categoryId: 2,
        isBundle: true,
        isLoyaltyPromo: true,
        discountPercent: 100,
        bundleItems: [{ menuItemId, name: "Kopi Susu", quantity: 1 }],
      });
    const openIt = async () => {
      api.getMenuItems.mockResolvedValue({
        data: { data: [menu(7, "Kopi Susu", 18000, 6000), freePromo(20, "Gratis Minuman", 7), freePromo(31, "Loyalty Lama", 7)] },
      });
      api.getLoyaltyProgram.mockResolvedValueOnce({
        data: {
          data: {
            active: true,
            rewards: [
              { id: 1, stamps: 5, label: "Minuman gratis", active: true, promo_menu_item_id: 20 },
              { id: 2, stamps: 10, label: "Makanan gratis", active: true, promo_menu_item_id: 31 },
            ],
          },
        },
      });
      api.updateMenuItem.mockResolvedValue({ data: { success: true } });
      api.updateLoyaltyReward.mockReset().mockResolvedValue({ data: { success: true } });
      renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });
      fireEvent.click(screen.getByRole("button", { name: "Promo" }));
      fireEvent.click(
        within((await screen.findByText("Gratis Minuman")).closest("section")).getByRole("button", { name: "Ubah" })
      );
    };

    it("moves a reward another menu gives to it, and lets go of the old one", async () => {
      await openIt();

      const reward = screen.getByLabelText("Hadiah Stamp Card");
      expect(reward).toHaveValue("1");
      expect(optionNames(reward)).toEqual([
        "Pilih hadiah",
        "Stamp ke-5 · Minuman gratis",
        "Stamp ke-10 · Makanan gratis (dipakai Loyalty Lama)",
      ]);
      fireEvent.change(reward, { target: { value: "2" } });
      fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

      await waitFor(() => expect(api.updateLoyaltyReward).toHaveBeenCalledTimes(2));
      expect(api.updateLoyaltyReward).toHaveBeenCalledWith({ id: 1, promoMenuItemId: null });
      expect(api.updateLoyaltyReward).toHaveBeenCalledWith({ id: 2, promoMenuItemId: 20 });
    });

    it("lets go of its reward as a Paket biasa", async () => {
      await openIt();

      fireEvent.change(screen.getByLabelText("Jenis promo"), { target: { value: "paket" } });
      fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

      await waitFor(() => expect(api.updateLoyaltyReward).toHaveBeenCalledWith({ id: 1, promoMenuItemId: null }));
      expect(api.updateMenuItem.mock.calls[0][0]).toMatchObject({ menuItemId: 20, isLoyaltyPromo: false });
      expect(api.updateLoyaltyReward).toHaveBeenCalledTimes(1);
    });

    it("keeps the menu saved when its reward can't follow, and says so", async () => {
      await openIt();
      api.updateLoyaltyReward.mockRejectedValue({ response: { data: { message: "Loyalty sedang tidak tersedia." } } });

      fireEvent.change(screen.getByLabelText("Hadiah Stamp Card"), { target: { value: "2" } });
      fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

      expect(await screen.findByText("Menu berhasil diubah.")).toBeInTheDocument();
      expect(
        await screen.findByText("Hadiah Stamp Card gagal dihubungkan: Loyalty sedang tidak tersedia.")
      ).toBeInTheDocument();
    });
  });

  it("lists Hadiah Stamp Card disabled and asks no stamp card without a loyalty key (Pengaturan → API)", async () => {
    api.getIntegrationStatus.mockResolvedValueOnce({ data: { success: true, data: { loyalty: false } } });
    api.getLoyaltyProgram.mockClear();
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });
    fireEvent.click(await screen.findByRole("button", { name: "Promo" }));
    fireEvent.click(
      within((await screen.findByText("Paket Hemat")).closest("section")).getByRole("button", { name: "Ubah" })
    );

    const kind = screen.getByLabelText("Jenis promo");
    expect(optionNames(kind)).toEqual(["Paket biasa", "Hadiah Stamp Card (API) · nonaktif"]);
    expect(kind.options[1]).toBeDisabled();
    expect(api.getLoyaltyProgram).not.toHaveBeenCalled();
  });

  it("shows Jenis promo right under Category, Hadiah Stamp Card disabled while the stamp card is off", async () => {
    const { unmount } = renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });
    fireEvent.click(await screen.findByRole("button", { name: "Promo" }));
    fireEvent.click(
      within((await screen.findByText("Paket Hemat")).closest("section")).getByRole("button", { name: "Ubah" })
    );

    const kind = await screen.findByLabelText("Jenis promo");
    // Before Nama Menu, after Category.
    const nameInput = screen.getByPlaceholderText("Latte");
    expect(kind.compareDocumentPosition(nameInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    unmount();

    api.getLoyaltyProgram.mockResolvedValueOnce({ data: { data: { active: false, rewards: [] } } });
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });
    fireEvent.click(await screen.findByRole("button", { name: "Promo" }));
    fireEvent.click(
      within((await screen.findByText("Paket Hemat")).closest("section")).getByRole("button", { name: "Ubah" })
    );
    expect(screen.getByLabelText("Diskon (%)")).toBeInTheDocument();
    const off = screen.getByLabelText("Jenis promo");
    expect(off).toHaveValue("paket");
    expect(off.options[1]).toBeDisabled();
  });

  it("shows which reward each Hadiah Stamp Card gives", async () => {
    // Saved before its gross profit was kept at 0.
    const promo = (id, name) =>
      menu(id, name, 0, 0, { categoryId: 2, isBundle: true, isLoyaltyPromo: true, discountPercent: 100, grossProfit: -14803 });
    api.getMenuItems.mockResolvedValue({
      data: { data: [menu(7, "Kopi Susu", 18000, 6000), promo(30, "Loyalty Minuman"), promo(31, "Loyalty Lama")] },
    });
    api.getLoyaltyProgram.mockResolvedValueOnce({
      data: { data: { active: true, rewards: [{ id: 1, stamps: 5, label: "Minuman gratis", active: true, promo_menu_item_id: 30 }] } },
    });
    const { unmount } = renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });
    fireEvent.click(await screen.findByRole("button", { name: "Promo" }));

    // Without the stamp card above: a card each, saying which reward.
    expect(
      within(await screen.findByRole("region", { name: "Loyalty Minuman" })).getByText(
        "Gratis · Hadiah Stamp Card · Stamp ke-5 · Minuman gratis"
      )
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Loyalty Lama" })).getByText(
        "Gratis · Hadiah Stamp Card · belum dipilih hadiahnya"
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("-Rp 14.803")).not.toBeInTheDocument();
    unmount();

    // With it (Menu tab): a linked one shows on its reward's row only, whose
    // Ubah opens it; one with no reward keeps its card.
    api.getLoyaltyProgram.mockResolvedValueOnce({
      data: { data: { active: true, rewards: [{ id: 1, stamps: 5, label: "Minuman gratis", active: true, promo_menu_item_id: 30 }] } },
    });
    renderWithProviders(
      <MenuManagement
        renderPromoHeader={({ onEditMenu }) => (
          <button type="button" onClick={() => onEditMenu(30)}>
            Ubah menu hadiah stamp 5
          </button>
        )}
      />,
      { preloadedState: asAdmin }
    );
    fireEvent.click(await screen.findByRole("button", { name: "Promo" }));
    expect(await screen.findByRole("region", { name: "Loyalty Lama" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("region", { name: "Loyalty Minuman" })).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Ubah menu hadiah stamp 5" }));
    expect(screen.getByRole("heading", { name: "Ubah Promo" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Latte")).toHaveValue("Loyalty Minuman");
  });

  it("keeps a Hadiah Stamp Card free", async () => {
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });

    fireEvent.click(await screen.findByRole("button", { name: "Promo" }));
    fireEvent.click(
      within((await screen.findByText("Paket Hemat")).closest("section")).getByRole("button", { name: "Ubah" })
    );
    fireEvent.change(screen.getByLabelText("Jenis promo"), { target: { value: "loyalty" } });
    fireEvent.change(screen.getByLabelText("Harga"), { target: { value: "15000" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

    expect(await screen.findByText("Hadiah Stamp Card harus Harga 0 dan Diskon 100%.")).toBeInTheDocument();
    expect(api.updateMenuItem).not.toHaveBeenCalled();
  });

  it("switches a promo on or off with its card's switch, nothing else saved", async () => {
    api.setMenuItemAvailability.mockReset().mockResolvedValue({ data: { success: true } });
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });
    fireEvent.click(await screen.findByRole("button", { name: "Promo" }));

    const card = await screen.findByRole("region", { name: "Paket Hemat" });
    const active = within(card).getByRole("switch", { name: "Paket Hemat" });
    expect(active).toHaveAttribute("aria-checked", "true");
    fireEvent.click(active);

    await waitFor(() =>
      expect(api.setMenuItemAvailability).toHaveBeenCalledWith({ menuItemId: "20", isAvailable: false })
    );
    expect(await screen.findByText("Promo dinonaktifkan.")).toBeInTheDocument();
    expect(api.updateMenuItem).not.toHaveBeenCalled();
  });

  it("shows who bought a promo (Riwayat), with how many in all", async () => {
    api.getMenuItemSales.mockReset().mockResolvedValue({
      data: {
        success: true,
        data: {
          data: [
            {
              id: 7,
              orderId: 91,
              orderCode: "2611-0095",
              orderDate: "2026-11-09 11:48:10",
              customerName: "Adi",
              customerPhone: "081234567890",
              orderType: "Offline",
              quantity: 2,
              price: 56000,
            },
          ],
          meta: { page: 1, perPage: 20, total: 1, lastPage: 1 },
          summary: { orders: 1, quantity: 2, revenue: 56000 },
        },
      },
    });
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });
    fireEvent.click(await screen.findByRole("button", { name: "Promo" }));

    fireEvent.click(await screen.findByRole("button", { name: "Riwayat Paket Hemat" }));
    const dialog = await screen.findByRole("dialog", { name: "Riwayat Paket Hemat" });

    const row = (await within(dialog).findByText("2611-0095")).closest("tr");
    expect(plainText(Array.from(row.cells).map((cell) => cell.textContent))).toEqual([
      "09/11/26 11:48",
      "2611-0095",
      "Adi081234567890",
      "Offline",
      "2",
      "Rp 56.000",
    ]);
    expect(within(dialog).getByText("1 nota · 2 terjual · Rp 56.000", { normalizer: (text) => text.replace(/\s/g, " ") }))
      .toBeInTheDocument();
    expect(api.getMenuItemSales).toHaveBeenCalledWith({ menuItemId: 20, page: 1, perPage: 20 });

    fireEvent.click(within(dialog).getByRole("button", { name: "Tutup" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says when nobody bought a promo yet", async () => {
    api.getMenuItemSales.mockReset().mockResolvedValue({
      data: { success: true, data: { data: [], meta: { page: 1, perPage: 20, total: 0, lastPage: 1 }, summary: { orders: 0, quantity: 0, revenue: 0 } } },
    });
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });
    fireEvent.click(await screen.findByRole("button", { name: "Promo" }));
    fireEvent.click(await screen.findByRole("button", { name: "Riwayat Paket Hemat" }));

    expect(await screen.findByText("Belum ada yang membeli promo ini.")).toBeInTheDocument();
  });

  it("rejects a discount above 100%", async () => {
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });

    fireEvent.click(await screen.findByRole("button", { name: "Promo" }));
    fireEvent.click(
      within((await screen.findByText("Paket Hemat")).closest("section")).getByRole("button", { name: "Ubah" })
    );
    fireEvent.change(screen.getByLabelText("Diskon (%)"), { target: { value: "120" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

    expect(await screen.findByText("Diskon harus 0-100%.")).toBeInTheDocument();
    expect(api.updateMenuItem).not.toHaveBeenCalled();
  });

  it("needs at least one menu in a package", async () => {
    api.updateMenuItem.mockResolvedValue({ data: { success: true } });
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });

    fireEvent.click(await screen.findByRole("button", { name: "Promo" }));
    fireEvent.click(
      within((await screen.findByText("Paket Hemat")).closest("section")).getByRole("button", { name: "Ubah" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Hapus Pilihan Croissant" }));
    fireEvent.click(screen.getByRole("button", { name: "Hapus Pilihan Kopi Susu" }));
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

    expect(await screen.findByText("Paket minimal berisi 1 menu.")).toBeInTheDocument();
    expect(api.updateMenuItem).not.toHaveBeenCalled();
  });

  it("saves a package of a single menu", async () => {
    api.updateMenuItem.mockResolvedValue({ data: { success: true } });
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });

    fireEvent.click(await screen.findByRole("button", { name: "Promo" }));
    fireEvent.click(
      within((await screen.findByText("Paket Hemat")).closest("section")).getByRole("button", { name: "Ubah" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Hapus Pilihan Croissant" }));
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

    await waitFor(() => expect(api.updateMenuItem).toHaveBeenCalled());
    expect(api.updateMenuItem.mock.calls[0][0]).toMatchObject({
      bundleItems: [{ menuItemId: 7, quantity: 1 }],
    });
  });
});
