import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import { MenuContainer } from "../../src/features/pos";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  getCategories: vi.fn(),
  getMenuItems: vi.fn(),
}));

const categories = [
  { id: 1, name: "Coffee", taxRate: 10 },
  { id: 2, name: "Snack", taxRate: null },
];
const menuItems = [
  {
    id: 11,
    categoryId: 1,
    name: "Kopi Susu",
    price: 18000,
    regularPrice: 18000,
    includeOnlinePlatform: false,
    imagePath: "/uploads/menu/kopi.jpg",
  },
  {
    id: 12,
    categoryId: 1,
    name: "Americano",
    price: 15000,
    regularPrice: 15000,
    includeOnlinePlatform: true,
    onlinePrice: 19000,
  },
  { id: 21, categoryId: 2, name: "Kentang", price: 12000, regularPrice: 12000 },
];

const itemCard = (name) => screen.getAllByText(name).at(-1).closest("div.flex.min-h-\\[210px\\]");
const cart = (store) => store.getState().cart;

describe("POS menu", () => {
  beforeEach(() => {
    api.getCategories.mockResolvedValue({ data: { data: categories } });
    api.getMenuItems.mockResolvedValue({ data: { data: menuItems } });
  });

  it("adds items to the cart with their menu price and category tax", async () => {
    const { store } = renderWithProviders(<MenuContainer />, { route: "/menu" });
    await screen.findByText("Kopi Susu");
    expect(store.getState().customer.selectedCategoryName).toBe("Coffee");

    const kopi = itemCard("Kopi Susu");
    expect(kopi).toHaveTextContent(/Rp\s18\.000/);
    fireEvent.click(within(kopi).getByRole("button", { name: "+" }));
    fireEvent.click(within(kopi).getByRole("button", { name: "+" }));

    expect(cart(store).map((item) => [item.id, item.quantity, item.price, item.taxRate])).toEqual([
      ["1-11", 2, 36000, 10],
    ]);
    expect(cart(store)[0]).toMatchObject({
      sourceMenuItemId: 11,
      categoryName: "Coffee",
      basePrice: 18000,
      originalPrice: 18000,
    });
    expect(within(kopi).getByRole("img")).toHaveAttribute("src", expect.stringMatching(/\/uploads\/menu\/kopi\.jpg$/));
  });

  it("sets quantities from the input and removes at zero", async () => {
    const { store } = renderWithProviders(<MenuContainer />, { route: "/menu" });
    await screen.findByText("Americano");

    const americano = itemCard("Americano");
    fireEvent.change(within(americano).getByRole("spinbutton"), { target: { value: "5" } });
    expect(cart(store)[0]).toMatchObject({ id: "1-12", quantity: 5, price: 75000 });
    fireEvent.click(within(americano).getByRole("button", { name: "−" }));
    expect(cart(store)[0].quantity).toBe(4);
    fireEvent.change(within(americano).getByRole("spinbutton"), { target: { value: "0" } });
    expect(cart(store)).toEqual([]);
  });

  it("shows only online items with their online price for online orders", async () => {
    const { store } = renderWithProviders(<MenuContainer />, {
      route: "/menu",
      preloadedState: { customer: { orderType: "Online", catering: {} } },
    });
    await screen.findByText("Americano");

    expect(screen.queryByText("Kopi Susu")).not.toBeInTheDocument();
    const americano = itemCard("Americano");
    expect(americano).toHaveTextContent(/Rp\s19\.000/);
    fireEvent.click(within(americano).getByRole("button", { name: "+" }));
    expect(cart(store)[0]).toMatchObject({ pricePerQuantity: 19000, originalPrice: 15000 });
  });

  it("switches category from the category cards", async () => {
    renderWithProviders(<MenuContainer />, { route: "/menu" });
    await screen.findByText("Kopi Susu");

    fireEvent.click(screen.getAllByText("Snack").at(-1));
    expect(await screen.findByText("Kentang")).toBeInTheDocument();
    expect(screen.queryByText("Americano")).not.toBeInTheDocument();
  });
});
