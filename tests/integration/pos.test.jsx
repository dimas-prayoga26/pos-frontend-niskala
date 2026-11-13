import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import { MenuContainer } from "../../src/features/pos";
import CartInfo from "../../src/features/pos/components/CartInfo";
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

// The menu card of an item (its name may also show in the cart).
const itemCard = (name) =>
  screen
    .getAllByText(name)
    .map((element) => element.closest("div.flex.min-h-\\[210px\\]"))
    .find(Boolean);
const cart = (store) => store.getState().cart;

describe("POS menu", () => {
  beforeEach(() => {
    api.getCategories.mockResolvedValue({ data: { data: categories } });
    api.getMenuItems.mockResolvedValue({ data: { data: menuItems } });
  });

  it("adds items to the cart with their menu price and category tax", async () => {
    const { store } = renderWithProviders(<MenuContainer />, { route: "/menu" });
    await screen.findByText("Kopi Susu");
    // Dispatched by an effect after the menu renders.
    await waitFor(() => expect(store.getState().customer.selectedCategoryName).toBe("Coffee"));

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

  it("shows what is inside a promo package and sells it as one item", async () => {
    api.getCategories.mockResolvedValue({
      data: { data: [...categories, { id: 3, name: "Promo", taxRate: null, isBundle: true }] },
    });
    api.getMenuItems.mockResolvedValue({
      data: {
        data: [
          ...menuItems,
          {
            id: 31,
            categoryId: 3,
            name: "Paket Hemat",
            price: 28000,
            regularPrice: 28000,
            isBundle: true,
            bundleItems: [
              { menuItemId: 11, name: "Kopi Susu", quantity: 2 },
              { menuItemId: 21, name: "Kentang", quantity: 1 },
            ],
          },
        ],
      },
    });
    const { store } = renderWithProviders(<MenuContainer />, { route: "/menu" });
    await screen.findByText("Kopi Susu");

    fireEvent.click(screen.getAllByText("Promo").at(-1));
    expect(await screen.findByText("2× Kopi Susu · 1× Kentang")).toBeInTheDocument();
    fireEvent.click(within(itemCard("Paket Hemat")).getByRole("button", { name: "+" }));

    expect(cart(store).map((item) => [item.id, item.quantity, item.price, item.sourceMenuItemId])).toEqual([
      ["3-31", 1, 28000, 31],
    ]);
  });

  it("picks the menus of a package's choice in the order details", async () => {
    api.getCategories.mockResolvedValue({
      data: { data: [...categories, { id: 3, name: "Promo", taxRate: null, isBundle: true }] },
    });
    api.getMenuItems.mockResolvedValue({
      data: {
        data: [
          ...menuItems,
          {
            id: 32,
            categoryId: 3,
            name: "Paket Ngopi",
            price: 35000,
            regularPrice: 35000,
            isBundle: true,
            bundleItems: [{ menuItemId: 21, name: "Kentang", quantity: 1 }],
            bundleChoices: [{ categoryId: 1, categoryName: "Coffee", quantity: 2 }],
          },
        ],
      },
    });
    // jsdom has no scrolling; the cart scrolls to its newest line.
    Element.prototype.scrollTo ??= () => {};
    const { store } = renderWithProviders(
      <>
        <MenuContainer />
        <CartInfo />
      </>,
      { route: "/menu" }
    );
    await screen.findByText("Kopi Susu");

    fireEvent.click(screen.getAllByText("Promo").at(-1));
    expect(await screen.findByText("1× Kentang · 2× Pilihan Coffee")).toBeInTheDocument();
    fireEvent.click(within(itemCard("Paket Ngopi")).getByRole("button", { name: "+" }));

    // The package goes straight to the cart with its fixed menu; its coffees
    // are picked there.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Kentang")).toBeInTheDocument();
    expect(cart(store).map((item) => [item.id, item.quantity, item.price, item.sourceMenuItemId, item.bundleChoices])).toEqual([
      ["3-32~1", 1, 35000, 32, []],
    ]);
    const first = screen.getByLabelText("Pilih Coffee 1");
    expect(Array.from(first.options).map((option) => option.textContent)).toEqual([
      "Pilih Coffee",
      "Kopi Susu",
      "Americano",
    ]);
    fireEvent.change(first, { target: { value: "11" } });
    fireEvent.change(screen.getByLabelText("Pilih Coffee 2"), { target: { value: "12" } });
    expect(cart(store)[0].bundleChoices).toEqual([
      { menuItemId: 11, name: "Kopi Susu", quantity: 1 },
      { menuItemId: 12, name: "Americano", quantity: 1 },
    ]);

    // Each package gets its own line (and its own picks).
    fireEvent.click(within(itemCard("Paket Ngopi")).getByRole("button", { name: "+" }));
    expect(cart(store).map((item) => item.id)).toEqual(["3-32~1", "3-32~2"]);
    expect(within(itemCard("Paket Ngopi")).getByRole("spinbutton")).toHaveValue(2);

    // The card's minus takes back the last package.
    fireEvent.click(within(itemCard("Paket Ngopi")).getByRole("button", { name: "−" }));
    expect(cart(store).map((item) => item.id)).toEqual(["3-32~1"]);
  });

  it("lets the cashier pick one menu of a Pilihan Menu promo, and picks a lone menu itself", async () => {
    const promo = (id, name, menuItemIds) => ({
      id,
      categoryId: 3,
      name,
      price: 0,
      regularPrice: 0,
      discountPercent: 100,
      isBundle: true,
      bundleItems: [],
      bundleChoices: [{ categoryId: null, categoryName: "Menu", quantity: 1, menuItemIds }],
    });
    api.getCategories.mockResolvedValue({
      data: { data: [...categories, { id: 3, name: "Promo", taxRate: null, isBundle: true }] },
    });
    api.getMenuItems.mockResolvedValue({
      data: { data: [...menuItems, promo(33, "Review Maps", [11, 12]), promo(34, "Review Satu", [12])] },
    });
    Element.prototype.scrollTo ??= () => {};
    const { store } = renderWithProviders(
      <>
        <MenuContainer />
        <CartInfo />
      </>,
      { route: "/menu" }
    );
    await screen.findByText("Kopi Susu");

    fireEvent.click(screen.getAllByText("Promo").at(-1));
    await screen.findByText("Review Maps");
    fireEvent.click(within(itemCard("Review Maps")).getByRole("button", { name: "+" }));
    const select = screen.getByLabelText("Pilih Menu");
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual(["Pilih Menu", "Kopi Susu", "Americano"]);
    fireEvent.change(select, { target: { value: "12" } });
    expect(cart(store)[0].bundleChoices).toEqual([{ menuItemId: 12, name: "Americano", quantity: 1 }]);

    fireEvent.click(within(itemCard("Review Satu")).getByRole("button", { name: "+" }));
    expect(cart(store)[1].bundleChoices).toEqual([{ menuItemId: 12, name: "Americano", quantity: 1 }]);
  });

  it("swaps the nasi of a rice bowl for its pengganti, at its extra price, on a line of its own", async () => {
    api.getMenuItems.mockResolvedValue({
      data: {
        data: [
          ...menuItems,
          {
            id: 22,
            categoryId: 2,
            name: "Rice Bowl Ayam",
            price: 25000,
            regularPrice: 25000,
            ingredientChoices: [{
              semiItemId: 5,
              name: "Nasi Putih",
              quantity: 1,
              unit: "porsi",
              options: [{ semiItemId: 6, name: "Nasi Daun Jeruk", extraPrice: 2000, hppCost: 4100 }],
            }],
          },
        ],
      },
    });
    Element.prototype.scrollTo ??= () => {};
    const { store } = renderWithProviders(
      <>
        <MenuContainer />
        <CartInfo />
      </>,
      { route: "/menu" }
    );
    await screen.findByText("Kopi Susu");
    fireEvent.click(screen.getAllByText("Snack").at(-1));
    const bowl = await waitFor(() => itemCard("Rice Bowl Ayam"));

    fireEvent.click(within(bowl).getByRole("button", { name: "+" }));
    fireEvent.click(within(bowl).getByRole("button", { name: "+" }));
    const nasi = screen.getByLabelText("Pilihan Nasi Putih");
    expect(Array.from(nasi.options).map((option) => option.textContent.replace(/\s/g, " "))).toEqual([
      "Nasi Putih",
      "Nasi Daun Jeruk (+Rp 2.000)",
    ]);

    // Both portions get Nasi Daun Jeruk: Rp 27.000 each.
    fireEvent.change(nasi, { target: { value: "6" } });
    expect(cart(store).map((item) => [item.id, item.quantity, item.pricePerQuantity, item.price])).toEqual([
      ["2-22~swap-6", 2, 27000, 54000],
    ]);
    expect(cart(store)[0].ingredientSwaps).toEqual([
      { fromSemiItemId: 5, toSemiItemId: 6, fromName: "Nasi Putih", toName: "Nasi Daun Jeruk", extraPrice: 2000 },
    ]);

    // The card still adds plain portions, so one order can hold both.
    fireEvent.click(within(itemCard("Rice Bowl Ayam")).getByRole("button", { name: "+" }));
    expect(cart(store).map((item) => [item.id, item.quantity, item.price])).toEqual([
      ["2-22~swap-6", 2, 54000],
      ["2-22", 1, 25000],
    ]);
    expect(within(itemCard("Rice Bowl Ayam")).getByRole("spinbutton")).toHaveValue(3);

    // Back to Nasi Putih joins the plain line at the plain price.
    fireEvent.change(screen.getAllByLabelText("Pilihan Nasi Putih")[0], { target: { value: "" } });
    expect(cart(store).map((item) => [item.id, item.quantity, item.price])).toEqual([["2-22", 3, 75000]]);
  });

  it("offers only the menus a package's choice allows", async () => {
    Element.prototype.scrollTo ??= () => {};
    api.getCategories.mockResolvedValue({
      data: { data: [...categories, { id: 3, name: "Promo", taxRate: null, isBundle: true }] },
    });
    api.getMenuItems.mockResolvedValue({
      data: {
        data: [
          ...menuItems,
          {
            id: 42,
            categoryId: 3,
            name: "Paket Americano",
            price: 15000,
            regularPrice: 15000,
            isBundle: true,
            bundleItems: [],
            bundleChoices: [{ categoryId: 1, categoryName: "Coffee", quantity: 1, menuItemIds: [12] }],
          },
        ],
      },
    });
    renderWithProviders(
      <>
        <MenuContainer />
        <CartInfo />
      </>,
      { route: "/menu" }
    );
    await screen.findByText("Kopi Susu");
    fireEvent.click(screen.getAllByText("Promo").at(-1));
    fireEvent.click(within(itemCard("Paket Americano")).getByRole("button", { name: "+" }));

    expect(
      Array.from(screen.getByLabelText("Pilih Coffee").options).map((option) => option.textContent)
    ).toEqual(["Pilih Coffee", "Americano"]);
  });

  it("offers a choice's menus even after they moved to another category", async () => {
    Element.prototype.scrollTo ??= () => {};
    api.getCategories.mockResolvedValue({
      data: { data: [...categories, { id: 3, name: "Promo", taxRate: null, isBundle: true }] },
    });
    api.getMenuItems.mockResolvedValue({
      data: {
        data: [
          ...menuItems,
          {
            id: 43,
            categoryId: 3,
            name: "Paket Campur",
            price: 20000,
            regularPrice: 20000,
            isBundle: true,
            bundleItems: [],
            // Offered on Coffee, but Kentang now sits in Snack.
            bundleChoices: [{ categoryId: 1, categoryName: "Coffee", quantity: 1, menuItemIds: [11, 21] }],
          },
        ],
      },
    });
    renderWithProviders(
      <>
        <MenuContainer />
        <CartInfo />
      </>,
      { route: "/menu" }
    );
    await screen.findByText("Kopi Susu");
    fireEvent.click(screen.getAllByText("Promo").at(-1));
    fireEvent.click(within(itemCard("Paket Campur")).getByRole("button", { name: "+" }));

    expect(
      Array.from(screen.getByLabelText("Pilih Coffee").options).map((option) => option.textContent)
    ).toEqual(["Pilih Coffee", "Kopi Susu", "Kentang"]);
    // Menus of several categories are listed per category.
    expect(
      Array.from(screen.getByLabelText("Pilih Coffee").querySelectorAll("optgroup")).map((group) => [
        group.label,
        Array.from(group.children).map((option) => option.textContent),
      ])
    ).toEqual([
      ["Coffee", ["Kopi Susu"]],
      ["Snack", ["Kentang"]],
    ]);
  });

  it("sells a promo at its price less its discount percent", async () => {
    Element.prototype.scrollTo ??= () => {};
    api.getCategories.mockResolvedValue({
      data: { data: [...categories, { id: 3, name: "Promo", taxRate: null, isBundle: true }] },
    });
    api.getMenuItems.mockResolvedValue({
      data: {
        data: [
          ...menuItems,
          {
            id: 40,
            categoryId: 3,
            name: "Review GMaps",
            price: 18000,
            regularPrice: 18000,
            isBundle: true,
            discountPercent: 100,
            bundleItems: [],
            bundleChoices: [{ categoryId: 1, categoryName: "Coffee", quantity: 1 }],
          },
          {
            id: 41,
            categoryId: 3,
            name: "Paket Diskon",
            price: 30000,
            regularPrice: 30000,
            isBundle: true,
            discountPercent: 20,
            bundleItems: [
              { menuItemId: 11, name: "Kopi Susu", quantity: 1, price: 18000 },
              { menuItemId: 21, name: "Kentang", quantity: 1, price: 12000 },
            ],
            bundleChoices: [],
          },
        ],
      },
    });
    const { store } = renderWithProviders(
      <>
        <MenuContainer />
        <CartInfo />
      </>,
      { route: "/menu" }
    );
    await screen.findByText("Kopi Susu");
    fireEvent.click(screen.getAllByText("Promo").at(-1));

    // Cards show the price less the discount.
    const review = await screen.findByText("Review GMaps");
    const reviewCard = review.closest("div.flex.min-h-\\[210px\\]");
    expect(within(reviewCard).getByText(/Rp\s0/)).toBeInTheDocument();
    expect(within(itemCard("Paket Diskon")).getByText(/Rp\s24\.000/)).toBeInTheDocument();

    fireEvent.click(within(reviewCard).getByRole("button", { name: "+" }));
    fireEvent.change(screen.getByLabelText("Pilih Coffee"), { target: { value: "11" } });
    expect(
      cart(store).map((item) => [item.id, item.pricePerQuantity, item.discountPercent, item.price])
    ).toEqual([["3-40~1", 18000, 100, 0]]);
  });

  it("makes a Kategori Promo stand out among the category cards", async () => {
    api.getCategories.mockResolvedValue({
      data: {
        data: [
          ...categories,
          { id: 3, name: "PROMO", taxRate: null, isBundle: true },
          { id: 4, name: "Spesial", taxRate: null, isBundle: true },
        ],
      },
    });
    renderWithProviders(<MenuContainer />, { route: "/menu" });
    await screen.findByText("Kopi Susu");

    const cardOf = (name) => screen.getAllByText(name).at(-1).closest("div.cursor-pointer");
    expect(cardOf("PROMO")).toHaveAttribute("data-promo", "true");
    expect(cardOf("Snack")).not.toHaveAttribute("data-promo");
    // A promo whose name does not say so gets a Promo tag.
    expect(within(cardOf("Spesial")).getByText("Promo")).toBeInTheDocument();
    expect(within(cardOf("PROMO")).queryByText("Promo")).not.toBeInTheDocument();
  });

  it("switches category from the category cards", async () => {
    renderWithProviders(<MenuContainer />, { route: "/menu" });
    await screen.findByText("Kopi Susu");

    fireEvent.click(screen.getAllByText("Snack").at(-1));
    expect(await screen.findByText("Kentang")).toBeInTheDocument();
    expect(screen.queryByText("Americano")).not.toBeInTheDocument();
  });
});
