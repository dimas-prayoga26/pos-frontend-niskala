import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import MenuPage from "../../src/features/pos/pages/MenuPage";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  // Pengaturan → API: the loyalty key is set (a test may answer otherwise).
  getIntegrationStatus: vi.fn(async () => ({ data: { success: true, data: { loyalty: true } } })),
  addOrder: vi.fn(),
  getCategories: vi.fn(),
  getMenuItems: vi.fn(),
  getOrderPlatforms: vi.fn(),
  getLoyaltyCustomer: vi.fn(),
  getLoyaltyProgram: vi.fn(),
}));

const CATEGORIES = [
  { id: 1, name: "Black Coffee" },
  { id: 2, name: "Hot White Coffee" },
  { id: 9, name: "PROMO", isBundle: true },
];
const PAKET = { id: 40, categoryId: 9, name: "Paket Hemat", price: 30000, bundleItems: [{ menuItemId: 11, name: "Americano", quantity: 1 }] };
// A Kategori Promo menu set as Promo loyalty: free, one coffee to pick.
// Program Promo links the stamp-5 reward to it (promo_menu_item_id 50).
const REWARD_PROMO = {
  id: 50,
  categoryId: 9,
  name: "Loyalty Minuman",
  price: 0,
  regularPrice: 0,
  discountPercent: 100,
  isLoyaltyPromo: true,
  bundleChoices: [{ id: 1, categoryId: null, categoryName: "Pilihan Coffee", quantity: 1, menuItemIds: [11, 12] }],
};
const MENUS = [
  { id: 11, categoryId: 1, name: "Americano", price: 20000 },
  { id: 12, categoryId: 2, name: "Aren Latte", price: 24000 },
  PAKET,
  REWARD_PROMO,
];
const customer = {
  registered: true,
  stamp_min_order_total: 100000,
  customer: { code: "NSK-000002" },
  card: { stamps: 5, slots: 10 },
  next_reward: { remaining: 5, label: "Makanan gratis" },
  ready_rewards: [{ stamps: 5, label: "Minuman gratis", count: 1, promo_menu_item_id: 50 }],
  daily_limit_reached: false,
};

const typePhone = (phone) =>
  fireEvent.change(screen.getByPlaceholderText("0812-xxxx-xxxx"), { target: { value: phone } });
const tukar = () => screen.findByRole("button", { name: /Tukar Minuman gratis/ }, { timeout: 2000 });
const rewardLine = () => screen.getByLabelText("Loyalty Minuman, Minuman gratis");

describe("Loyalty reward as a Kategori Promo menu", () => {
  beforeEach(() => {
    Element.prototype.scrollTo ??= () => {};
    api.getCategories.mockResolvedValue({ data: { data: CATEGORIES } });
    api.getMenuItems.mockResolvedValue({ data: { data: MENUS } });
    api.getOrderPlatforms.mockResolvedValue({ data: { data: [] } });
    api.getLoyaltyCustomer.mockResolvedValue({ data: { data: customer } });
    api.getLoyaltyProgram.mockResolvedValue({ data: { success: true, data: { code: "stamp_card", active: true } } });
    api.addOrder.mockReset();
  });

  it("keeps the reward promo out of the menu grid", async () => {
    renderWithProviders(<MenuPage />, { route: "/menu" });
    await screen.findAllByText("Americano");

    fireEvent.click(screen.getByText("PROMO"));
    expect(await screen.findByText("Paket Hemat")).toBeInTheDocument();
    expect(screen.queryByText("Loyalty Minuman")).not.toBeInTheDocument();
  });

  it("puts the reward promo in the order on Tukar; its coffee is picked like any promo", async () => {
    const { store } = renderWithProviders(<MenuPage />, { route: "/menu" });
    await screen.findAllByText("Americano");
    typePhone("1234567890");

    fireEvent.click(await tukar());

    expect(await screen.findByText("🎁 Loyalty Minuman masuk pesanan · pilih menunya di Order Details")).toBeInTheDocument();
    expect(store.getState().cart).toEqual([
      expect.objectContaining({
        id: "loyalty-5-50-1",
        sourceMenuItemId: 50,
        name: "Loyalty Minuman",
        variant: "Minuman gratis",
        discountPercent: 100,
        price: 0,
        quantity: 1,
        bundleChoices: [],
        loyaltyReward: { stamps: 5, label: "Minuman gratis", phone: "1234567890" },
      }),
    ]);
    const line = rewardLine();
    expect(within(line).getByText("Hadiah loyalty · Minuman gratis")).toBeInTheDocument();
    // One free portion: no + / -, only Batal tukar.
    expect(within(line).queryByRole("button", { name: /Increase/ })).not.toBeInTheDocument();
    // The choice's menus, per category (Hot or Cold).
    const choice = within(line).getByLabelText("Pilih Pilihan Coffee");
    expect(within(choice).getByRole("group", { name: "Black Coffee" })).toHaveTextContent("Americano");
    expect(within(choice).getByRole("group", { name: "Hot White Coffee" })).toHaveTextContent("Aren Latte");

    fireEvent.change(choice, { target: { value: "12" } });
    expect(store.getState().cart[0].bundleChoices).toEqual([{ menuItemId: 12, name: "Aren Latte", quantity: 1 }]);

    // In the order: not offered again; Batal tukar gives it back.
    expect(screen.getByText("Minuman gratis di pesanan")).toBeInTheDocument();
    fireEvent.click(within(rewardLine()).getByRole("button", { name: "Batalkan Minuman gratis Loyalty Minuman" }));
    expect(store.getState().cart).toEqual([]);
    expect(await tukar()).toBeInTheDocument();
  });

  it("saves the reward with its pick, nothing to pay, and says it was redeemed", async () => {
    api.addOrder.mockResolvedValue({
      data: {
        data: { id: 90, orderId: "NSK-90", bills: { totalWithTax: 0 }, items: [] },
        loyalty: { redeemed: [{ label: "Minuman gratis", menuName: "Loyalty Minuman (Aren Latte)" }], warnings: [] },
      },
    });
    renderWithProviders(<MenuPage />, { route: "/menu" });
    await screen.findAllByText("Americano");
    typePhone("1234567890");
    fireEvent.click(await tukar());

    // The coffee comes first, as for any promo with a choice.
    fireEvent.click(screen.getByRole("button", { name: "Place Order" }));
    expect(await screen.findByText("Pilih menu isi paket dulu.")).toBeInTheDocument();
    expect(api.addOrder).not.toHaveBeenCalled();

    fireEvent.change(within(rewardLine()).getByLabelText("Pilih Pilihan Coffee"), { target: { value: "11" } });
    fireEvent.click(screen.getByRole("button", { name: "Place Order" }));

    await waitFor(() => expect(api.addOrder).toHaveBeenCalled());
    expect(api.addOrder.mock.calls[0][0]).toMatchObject({
      orderType: "Offline",
      paymentMethod: "Tunai",
      customerDetails: { phone: "1234567890" },
      bills: { total: 0, totalWithTax: 0 },
      items: [
        expect.objectContaining({
          sourceMenuItemId: 50,
          price: 0,
          bundleChoices: [{ menuItemId: 11, name: "Americano", quantity: 1 }],
          loyaltyReward: expect.objectContaining({ stamps: 5 }),
        }),
      ],
    });
    expect(await screen.findByText("🎁 Minuman gratis ditukar · Loyalty Minuman (Aren Latte)")).toBeInTheDocument();
  });

  it("takes the reward out when the phone changes", async () => {
    const { store } = renderWithProviders(<MenuPage />, { route: "/menu" });
    await screen.findAllByText("Americano");
    typePhone("1234567890");
    fireEvent.click(await tukar());
    expect(store.getState().cart).toHaveLength(1);

    typePhone("0812");
    await waitFor(() => expect(store.getState().cart).toEqual([]));
  });

  it("takes the reward out when the stamp card is switched off", async () => {
    const { store, queryClient } = renderWithProviders(<MenuPage />, { route: "/menu" });
    await screen.findAllByText("Americano");
    typePhone("1234567890");
    fireEvent.click(await tukar());
    expect(store.getState().cart).toHaveLength(1);

    act(() => queryClient.setQueryData(["loyalty-program"], { data: { success: true, data: { active: false } } }));

    await waitFor(() => expect(store.getState().cart).toEqual([]));
    expect(screen.queryByRole("button", { name: /Tukar Minuman gratis/ })).not.toBeInTheDocument();
  });

  it("says when no Promo loyalty menu is linked to a ready reward yet", async () => {
    api.getLoyaltyCustomer.mockResolvedValue({
      data: { data: { ...customer, ready_rewards: [{ ...customer.ready_rewards[0], promo_menu_item_id: null }] } },
    });
    renderWithProviders(<MenuPage />, { route: "/menu" });
    await screen.findAllByText("Americano");
    typePhone("1234567890");

    expect(await screen.findByText("Minuman gratis siap · menu promonya belum ada", {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tukar Minuman gratis/ })).not.toBeInTheDocument();
  });
});
