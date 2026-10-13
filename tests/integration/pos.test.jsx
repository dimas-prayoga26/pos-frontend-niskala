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
    price: null,
    regularPrice: null,
    includeOnlinePlatform: false,
    sizes: [
      { name: "Reguler", price: 18000 },
      { name: "Large", price: 24000 },
    ],
    variants: ["Hot", "Ice"],
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
    sizes: [],
    variants: [],
  },
  { id: 21, categoryId: 2, name: "Kentang", price: 12000, regularPrice: 12000, sizes: [] },
];

const itemCard = (name) => screen.getAllByText(name).at(-1).closest("div.flex.min-h-\\[210px\\]");
const cart = (store) => store.getState().cart;

describe("POS menu", () => {
  beforeEach(() => {
    api.getCategories.mockResolvedValue({ data: { data: categories } });
    api.getMenuItems.mockResolvedValue({ data: { data: menuItems } });
  });

  it("adds items to the cart with size-specific ids and prices", async () => {
    const { store } = renderWithProviders(<MenuContainer />, { route: "/menu" });
    await screen.findByText("Kopi Susu");
    expect(store.getState().customer.selectedCategoryName).toBe("Coffee");

    const kopi = itemCard("Kopi Susu");
    fireEvent.click(within(kopi).getByRole("button", { name: "+" }));
    fireEvent.click(within(kopi).getByRole("button", { name: "Large" }));
    expect(kopi).toHaveTextContent(/Rp\s24\.000/);
    fireEvent.click(within(kopi).getByRole("button", { name: "+" }));
    fireEvent.click(within(kopi).getByRole("button", { name: "+" }));

    expect(cart(store).map((item) => [item.id, item.quantity, item.price, item.taxRate])).toEqual([
      ["1-11-Reguler", 1, 18000, 10],
      ["1-11-Large", 2, 48000, 10],
    ]);
    expect(cart(store)[1]).toMatchObject({
      sourceMenuItemId: 11,
      sizeVariant: "Large",
      categoryName: "Coffee",
      temperatureOptions: ["Hot", "Ice"],
      sizePrices: { Reguler: 18000, Large: 24000 },
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
