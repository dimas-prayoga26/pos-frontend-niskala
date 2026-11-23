import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import { PromoProgramSettings, SettingsManagement } from "../../src/features/settings";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  getLoyaltyProgram: vi.fn(),
  getLoyaltyRedemptions: vi.fn(),
  getLoyaltyStamps: vi.fn(),
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
// Menu → Kategori Promo: two Hadiah Stamp Card, one Paket biasa.
const MENUS = [
  { id: 50, name: "Loyalty Minuman Gratis", isLoyaltyPromo: true },
  { id: 60, name: "Loyalty Makanan Gratis", isLoyaltyPromo: true },
  { id: 40, name: "Paket Hemat", isLoyaltyPromo: false },
];

// Dashboard → Menu → Promo, above the promos (tests/integration/dashboard.test.jsx).
const openProgramPromo = async () => {
  renderWithProviders(<PromoProgramSettings />, { preloadedState: asAdmin });
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

  it("is not under Pengaturan", () => {
    for (const preloadedState of [asAdmin, asCashier]) {
      const { unmount } = renderWithProviders(<SettingsManagement />, { preloadedState });
      expect(screen.queryByRole("button", { name: "Stamp Card" })).not.toBeInTheDocument();
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

  it("shows the menu each reward gives, picked in the promo form (not here)", async () => {
    const card = await openProgramPromo();

    expect(await within(card).findByText("Loyalty Makanan Gratis")).toBeInTheDocument();
    expect(within(card).getByLabelText("Menu hadiah Stamp ke-10 · Makanan gratis")).toHaveTextContent(
      "Loyalty Makanan Gratis"
    );
    expect(within(card).getByLabelText("Menu hadiah Stamp ke-5 · Minuman gratis")).toHaveTextContent("Belum ada menu");
    expect(within(card).queryByRole("combobox")).not.toBeInTheDocument();
    expect(
      within(card).getByText("Pilih menunya lewat Tambah Promo → Jenis promo: Hadiah stamp card.")
    ).toBeInTheDocument();
  });

  it("opens a reward's menu from its row (Ubah)", async () => {
    const onEditMenu = vi.fn();
    renderWithProviders(<PromoProgramSettings onEditMenu={onEditMenu} />, { preloadedState: asAdmin });
    const card = await screen.findByRole("region", { name: "Stamp Card" });

    // Stamp 5 has no menu yet: nothing to open.
    expect(within(card).queryByRole("button", { name: "Ubah menu hadiah Stamp ke-5 · Minuman gratis" })).not.toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Ubah menu hadiah Stamp ke-10 · Makanan gratis" }));
    expect(onEditMenu).toHaveBeenCalledWith(60);
  });

  it("says nothing more once every reward has its menu", async () => {
    const linked = program();
    linked.rewards[0] = { ...linked.rewards[0], promo_menu_item_id: 50 };
    api.getLoyaltyProgram.mockResolvedValue(answer(linked));
    const card = await openProgramPromo();

    expect(await within(card).findByText("Loyalty Minuman Gratis")).toBeInTheDocument();
    expect(within(card).queryByText(/Pilih menunya/)).not.toBeInTheDocument();
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
    const STAMPED = {
      id: 31,
      stamped_at: "2026-11-19T10:15:00+07:00",
      stamp_number: 3,
      card_number: "NSK-000002-01",
      customer: { code: "NSK-000002", name: "Budi", phone: "621234567890" },
      order: { id: 88, code: "NSK-88" },
      cashier: "Kasir Pagi",
    };
    // Given by loyalty:give-stamps: no order, no cashier.
    const GIVEN = { ...STAMPED, id: 30, stamp_number: 2, order: null, cashier: null };
    const history = (data, meta) => answer({ data, meta: { page: 1, per_page: 20, total: data.length, last_page: 1, ...meta } });
    const openStampHistory = async () => {
      const card = await openProgramPromo();
      fireEvent.click(within(card).getByRole("button", { name: "Riwayat" }));
      return screen.findByRole("dialog", { name: "Riwayat Stamp Card" });
    };
    const openHistory = async () => {
      const dialog = await openStampHistory();
      fireEvent.click(within(within(dialog).getByRole("group", { name: "Jenis riwayat" })).getByRole("button", { name: "Tukar Hadiah" }));
      return dialog;
    };

    beforeEach(() => {
      api.getLoyaltyStamps.mockReset();
      api.getLoyaltyStamps.mockResolvedValue(history([STAMPED, GIVEN]));
      api.getLoyaltyRedemptions.mockReset();
      api.getLoyaltyRedemptions.mockResolvedValue(history([REDEEMED]));
    });

    it("opens on the stamps given: when, who, which stamp of which card, the nota and the cashier", async () => {
      const dialog = await openStampHistory();

      const views = within(dialog).getByRole("group", { name: "Jenis riwayat" });
      expect(within(views).getByRole("button", { name: "Stamp Masuk" })).toHaveAttribute("aria-pressed", "true");
      const row = (await within(dialog).findByText("NSK-88")).closest("tr");
      expect(Array.from(row.cells).map((cell) => cell.textContent)).toEqual([
        "19/11/26 10:15",
        "01234567890NSK-000002 · Budi",
        "Stamp ke-3NSK-000002-01",
        "NSK-88",
        "Kasir Pagi",
      ]);
      const given = within(dialog).getByText("Tanpa nota").closest("tr");
      expect(given.cells[2]).toHaveTextContent("Stamp ke-2");
      expect(given.cells[4]).toHaveTextContent("-");
      expect(within(dialog).getByText("2 stamp diberikan")).toBeInTheDocument();
      expect(api.getLoyaltyStamps).toHaveBeenCalledWith({ page: 1, perPage: 20, q: "" });
      expect(api.getLoyaltyRedemptions).not.toHaveBeenCalled();
    });

    it("says when no stamp was given yet", async () => {
      api.getLoyaltyStamps.mockResolvedValue(history([]));
      const dialog = await openStampHistory();

      expect(await within(dialog).findByText("Belum ada stamp yang diberikan.")).toBeInTheDocument();
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
    renderWithProviders(<PromoProgramSettings />, { preloadedState: asAdmin });

    expect(await screen.findByRole("alert")).toHaveTextContent("Loyalty sedang tidak tersedia.");
  });
});
