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
          menu(20, "Paket Hemat", 28000, 11400, {
            categoryId: 2,
            isBundle: true,
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
    expect(screen.getByText("Harga Promo")).toBeInTheDocument();
    // Only ordinary menus not in the package yet.
    const picker = screen.getByLabelText("Tambah menu paket");
    await waitFor(() => expect(optionNames(picker)).toEqual(["Pilih menu", "Teh"]));
    expect(screen.getByTestId("bundle-normal-price")).toHaveTextContent(/Rp\s33\.000/);
    expect(screen.getByTestId("bundle-hpp")).toHaveTextContent(/Rp\s11\.400/);
    expect(screen.getByTestId("bundle-saving")).toHaveTextContent(/Rp\s5\.000/);

    fireEvent.change(screen.getByLabelText("Jumlah Kopi Susu"), { target: { value: "2" } });
    $(picker).val("9").trigger($.Event("select2:select", { params: { data: { id: "9", text: "Teh" } } }));
    expect(await screen.findByLabelText("Jumlah Teh")).toHaveValue(1);
    fireEvent.click(screen.getByRole("button", { name: "Hapus Croissant" }));
    expect(screen.getByTestId("bundle-hpp")).toHaveTextContent(/Rp\s14\.000/);

    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    await waitFor(() => expect(api.updateMenuItem).toHaveBeenCalled());
    expect(api.updateMenuItem.mock.calls[0][0]).toMatchObject({
      menuItemId: 20,
      categoryId: "2",
      ingredients: [],
      bundleItems: [
        { menuItemId: 7, quantity: 2 },
        { menuItemId: 9, quantity: 1 },
      ],
      hppCost: 14000,
    });
  });

  it("needs at least two menus in a package", async () => {
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });

    fireEvent.click(await screen.findByRole("button", { name: "Menu Items" }));
    fireEvent.click(
      within((await screen.findByText("Paket Hemat")).closest("tr")).getByRole("button", { name: "Ubah" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Hapus Croissant" }));
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

    expect(await screen.findByText("Paket minimal berisi 2 menu.")).toBeInTheDocument();
    expect(api.updateMenuItem).not.toHaveBeenCalled();
  });
});
