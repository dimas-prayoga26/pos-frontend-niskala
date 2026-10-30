import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import MenuManagement from "../../src/components/dashboard/MenuManagement";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  getCategories: vi.fn(),
  getMenuItems: vi.fn(),
  getSemiItems: vi.fn(),
  getStockItems: vi.fn(),
  updateMenuItem: vi.fn(),
}));

const asAdmin = { user: { _id: 1, name: "Admin", email: "a", phone: "1", role: "Admin", isAuth: true } };
const optionNames = (select) => Array.from(select.options).map((option) => option.textContent);

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

  it("offers bahan resep and bahan setengah jadi only", async () => {
    renderWithProviders(<MenuManagement />, { preloadedState: asAdmin });

    await waitFor(() => expect(api.getStockItems).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole("button", { name: "Menu Items" }));
    fireEvent.click(await screen.findByRole("button", { name: "Tambah Menu" }));
    const recipeSection = screen.getByText("Komposisi Bahan").parentElement;
    fireEvent.click(within(recipeSection).getByRole("button", { name: "Tambah" }));

    const select = screen.getByLabelText("Stok bahan");
    await waitFor(() =>
      expect(optionNames(select)).toEqual(["Pilih dari stok", "Susu Segar", "Gula Lama", "Nasi (Setengah jadi)"])
    );
    expect(screen.getByText(/hanya yang bertanda Bahan Resep/)).toBeInTheDocument();
  });

  it("fills Nasi in gram, like the COGS sheet, and saves it in portions", async () => {
    // Nasi: 1 porsi = 150 gr, Rp 4.125 a portion.
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

    // 1 porsi in the recipe shows as 150 gr.
    const quantity = await screen.findByLabelText("Jumlah bahan");
    expect(quantity).toHaveValue(150);
    expect(screen.getByLabelText("Satuan bahan")).toHaveValue("gr");
    expect(screen.getByText(/1 porsi Nasi = 150 gr, jadi 150 gr = 1 porsi/)).toBeInTheDocument();
    expect(screen.getByLabelText("Cost bahan").value).toMatch(/^Rp\s4\.125$/);

    // 225 gr = 1,5 porsi = Rp 6.187,5.
    fireEvent.change(quantity, { target: { value: "225" } });
    expect(screen.getByText(/225 gr = 1,5 porsi/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    await waitFor(() => expect(api.updateMenuItem).toHaveBeenCalled());
    expect(api.updateMenuItem.mock.calls[0][0].ingredients).toEqual([
      { stockItemId: null, semiItemId: 5, quantity: 1.5, note: "" },
    ]);
  });
});
