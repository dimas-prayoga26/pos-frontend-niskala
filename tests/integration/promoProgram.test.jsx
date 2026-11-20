import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import { PromoProgramPage, SettingsManagement } from "../../src/features/settings";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  getLoyaltyProgram: vi.fn(),
  getLoyaltyRedemptions: vi.fn(),
  getMenuItems: vi.fn(),
  getOrderPlatforms: vi.fn(),
  updateLoyaltyProgram: vi.fn(),
  updateLoyaltyReward: vi.fn(),
}));

const asAdmin = { user: { _id: 1, name: "Admin", email: "a", phone: "1", role: "Admin", isAuth: true } };
const asCashier = { user: { _id: 2, name: "Kasir", email: "k", phone: "2", role: "Cashier", isAuth: true } };
const program = (overrides = {}) => ({
  code: "stamp_card",
  name: "Stamp Card",
  active: true,
  rules: { min_order_total: 100000, stamps_per_card: 10, max_stamps_per_day: 1 },
  rewards: [
    { id: 1, stamps: 5, label: "Minuman gratis", short: "Minuman", active: true, promo_menu_item_id: null },
    { id: 2, stamps: 10, label: "Makanan gratis", short: "Makanan", active: true, promo_menu_item_id: 60 },
  ],
  ...overrides,
});
const answer = (data) => ({ data: { success: true, data } });
// Menu → Kategori Promo: two set as Promo loyalty, one ordinary promo.
const MENUS = [
  { id: 50, name: "Loyalty Minuman Gratis", isLoyaltyPromo: true },
  { id: 60, name: "Loyalty Makanan Gratis", isLoyaltyPromo: true },
  { id: 40, name: "Paket Hemat", isLoyaltyPromo: false },
];
const optionNames = (select) => Array.from(select.options).map((option) => option.textContent);

// Dashboard → Program Promo (admins, after Rekap: tests/integration/dashboard.test.jsx).
const openProgramPromo = async () => {
  renderWithProviders(<PromoProgramPage />, { preloadedState: asAdmin });
  expect(screen.getByRole("heading", { name: "Program Promo" })).toBeInTheDocument();
  return screen.findByRole("region", { name: "Stamp Card" });
};

describe("program promo", () => {
  beforeEach(() => {
    api.getOrderPlatforms.mockResolvedValue({ data: { data: [] } });
    api.getLoyaltyProgram.mockResolvedValue(answer(program()));
    api.getMenuItems.mockResolvedValue({ data: { data: MENUS } });
    api.updateLoyaltyProgram.mockReset();
    api.updateLoyaltyReward.mockReset();
  });

  it("is no longer under Pengaturan", () => {
    for (const preloadedState of [asAdmin, asCashier]) {
      const { unmount } = renderWithProviders(<SettingsManagement />, { preloadedState });

      expect(screen.queryByRole("button", { name: "Program Promo" })).not.toBeInTheDocument();
      unmount();
    }
  });

  it("shows the stamp card, its rules and its rewards, each with a switch", async () => {
    const card = await openProgramPromo();

    expect(within(card).getByRole("switch", { name: "Stamp Card" })).toHaveAttribute("aria-checked", "true");
    expect(
      within(card).getByText("1 stamp per nota ≥ Rp 100.000 · maks 1 stamp/hari · 10 stamp per kartu", {
        normalizer: (text) => text.replace(/\s/g, " "),
      })
    ).toBeInTheDocument();
    const rewards = within(within(card).getByRole("list", { name: "Hadiah" })).getAllByRole("listitem");
    expect(rewards.map((row) => row.getAttribute("aria-label"))).toEqual([
      "Stamp ke-5 · Minuman gratis",
      "Stamp ke-10 · Makanan gratis",
    ]);
    expect(within(card).getByRole("switch", { name: "Stamp ke-5 · Minuman gratis" })).toHaveAttribute("aria-checked", "true");
  });

  it("links each reward to the Promo loyalty menu its Tukar gives", async () => {
    const linked = program();
    linked.rewards[0] = { ...linked.rewards[0], promo_menu_item_id: 50 };
    api.updateLoyaltyReward.mockResolvedValue(answer(linked));
    const card = await openProgramPromo();

    // Only Promo loyalty menus are offered; stamp 10 already has its menu.
    const drinkMenu = within(card).getByLabelText("Menu promo Stamp ke-5 · Minuman gratis");
    await waitFor(() =>
      expect(optionNames(drinkMenu)).toEqual(["Belum ada menu", "Loyalty Minuman Gratis", "Loyalty Makanan Gratis"])
    );
    expect(drinkMenu).toHaveValue("");
    expect(within(card).getByLabelText("Menu promo Stamp ke-10 · Makanan gratis")).toHaveValue("60");

    fireEvent.change(drinkMenu, { target: { value: "50" } });

    await waitFor(() => expect(api.updateLoyaltyReward).toHaveBeenCalledWith({ id: 1, promoMenuItemId: 50 }));
    expect(await screen.findByText("Menu promo hadiah disimpan.")).toBeInTheDocument();
    expect(within(card).getByLabelText("Menu promo Stamp ke-5 · Minuman gratis")).toHaveValue("50");
  });

  it("points to Menu when there is no Promo loyalty menu yet", async () => {
    api.getMenuItems.mockResolvedValue({ data: { data: [MENUS[2]] } });
    const card = await openProgramPromo();

    expect(
      await within(card).findByText("Belum ada menu Promo loyalty: buat di Menu → kategori PROMO, Jenis promo: Promo loyalty.")
    ).toBeInTheDocument();
  });

  it("switches the stamp card off, then shows it off", async () => {
    api.updateLoyaltyProgram.mockResolvedValue(answer(program({ active: false })));
    const card = await openProgramPromo();

    fireEvent.click(within(card).getByRole("switch", { name: "Stamp Card" }));

    await waitFor(() => expect(api.updateLoyaltyProgram).toHaveBeenCalledWith({ active: false }));
    expect(await screen.findByText("Stamp Card dimatikan.")).toBeInTheDocument();
    expect(within(card).getByRole("switch", { name: "Stamp Card" })).toHaveAttribute("aria-checked", "false");
    expect(within(card).getByText("Nonaktif: kasir tidak memberi stamp maupun hadiah.")).toBeInTheDocument();
  });

  it("switches one reward off", async () => {
    const off = program();
    off.rewards[0] = { ...off.rewards[0], active: false };
    api.updateLoyaltyReward.mockResolvedValue(answer(off));
    const card = await openProgramPromo();

    fireEvent.click(within(card).getByRole("switch", { name: "Stamp ke-5 · Minuman gratis" }));

    await waitFor(() => expect(api.updateLoyaltyReward).toHaveBeenCalledWith({ id: 1, active: false }));
    expect(await screen.findByText("Hadiah dimatikan.")).toBeInTheDocument();
    expect(within(card).getByRole("switch", { name: "Stamp ke-5 · Minuman gratis" })).toHaveAttribute("aria-checked", "false");
  });

  it("has no form to add a reward", async () => {
    const card = await openProgramPromo();

    expect(within(card).queryByRole("button", { name: /Tambah hadiah/ })).not.toBeInTheDocument();
    expect(within(card).queryByLabelText("Nama hadiah")).not.toBeInTheDocument();
  });

  describe("Riwayat", () => {
    const REDEEMED = {
      id: 7,
      redeemed_at: "2026-11-20T13:05:00+07:00",
      customer: { code: "NSK-000002", name: null, phone: "621234567890" },
      reward: { stamps: 5, label: "Minuman gratis" },
      menu_name: "Loyalty Minuman (Americano)",
      order: { id: 90, code: "NSK-90" },
      cashier: "Kasir Pagi",
    };
    const history = (data, meta) => answer({ data, meta: { page: 1, per_page: 20, total: data.length, last_page: 1, ...meta } });
    const openHistory = async () => {
      const card = await openProgramPromo();
      fireEvent.click(within(card).getByRole("button", { name: "Riwayat" }));
      return screen.findByRole("dialog", { name: "Riwayat Tukar Hadiah" });
    };

    beforeEach(() => {
      api.getLoyaltyRedemptions.mockReset();
      api.getLoyaltyRedemptions.mockResolvedValue(history([REDEEMED]));
    });

    it("lists the rewards handed over: when, who, which reward and menu, the nota and the cashier", async () => {
      const dialog = await openHistory();

      const row = (await within(dialog).findByText("NSK-90")).closest("tr");
      expect(Array.from(row.cells).map((cell) => cell.textContent)).toEqual([
        "20/11/26 13:05",
        "01234567890NSK-000002",
        "Stamp ke-5 · Minuman gratis",
        "Loyalty Minuman (Americano)",
        "NSK-90",
        "Kasir Pagi",
      ]);
      expect(within(dialog).getByText("1 hadiah ditukar")).toBeInTheDocument();
      expect(api.getLoyaltyRedemptions).toHaveBeenCalledWith({ page: 1, perPage: 20, q: "" });

      fireEvent.click(within(dialog).getByRole("button", { name: "Tutup" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("searches by phone and pages through", async () => {
      api.getLoyaltyRedemptions.mockResolvedValue(history([REDEEMED], { total: 25, last_page: 2 }));
      const dialog = await openHistory();
      await within(dialog).findByText("NSK-90");

      fireEvent.click(within(dialog).getByRole("button", { name: "Berikutnya" }));
      await waitFor(() => expect(api.getLoyaltyRedemptions).toHaveBeenLastCalledWith({ page: 2, perPage: 20, q: "" }));

      fireEvent.change(within(dialog).getByLabelText("Cari riwayat"), { target: { value: "0812" } });
      await waitFor(() => expect(api.getLoyaltyRedemptions).toHaveBeenLastCalledWith({ page: 1, perPage: 20, q: "0812" }));
    });

    it("says when nothing was handed over yet", async () => {
      api.getLoyaltyRedemptions.mockResolvedValue(history([]));
      const dialog = await openHistory();

      expect(await within(dialog).findByText("Belum ada hadiah yang ditukar.")).toBeInTheDocument();
      expect(within(dialog).queryByRole("button", { name: "Berikutnya" })).not.toBeInTheDocument();
    });
  });

  it("says when loyalty can't be reached", async () => {
    api.getLoyaltyProgram.mockRejectedValue({ response: { data: { message: "Loyalty sedang tidak tersedia." } } });
    renderWithProviders(<PromoProgramPage />, { preloadedState: asAdmin });

    expect(await screen.findByRole("alert")).toHaveTextContent("Loyalty sedang tidak tersedia.");
  });
});
