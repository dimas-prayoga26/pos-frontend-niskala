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
});
