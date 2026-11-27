import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import { MemberStampCard, PromoProgramSettings, SettingsManagement } from "../../src/features/settings";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  getLoyaltyMembers: vi.fn(),
  getLoyaltyProgram: vi.fn(),
  getLoyaltyRedemptions: vi.fn(),
  getLoyaltyStamps: vi.fn(),
  getMenuItems: vi.fn(),
  getOrderPlatforms: vi.fn(),
  resetLoyaltyMemberPin: vi.fn(),
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

  it("has no Riwayat any more: members, stamps and rewards are under Dashboard → Member Stamp Card", async () => {
    const card = await openProgramPromo();

    expect(within(card).queryByRole("button", { name: "Riwayat" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("has no form to add a reward", async () => {
    const card = await openProgramPromo();

    expect(within(card).queryByRole("button", { name: /Tambah hadiah/ })).not.toBeInTheDocument();
    expect(within(card).queryByLabelText("Nama hadiah")).not.toBeInTheDocument();
  });

  // Dashboard → Member Stamp Card (tests/integration/dashboard.test.jsx opens it).
  describe("Member Stamp Card", () => {
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
      renderWithProviders(<MemberStampCard />, { preloadedState: asAdmin });
      return screen.findByRole("region", { name: "Member Stamp Card" });
    };
    const openView = async (label) => {
      const dialog = await openStampHistory();
      fireEvent.click(within(within(dialog).getByRole("group", { name: "Jenis data stamp card" })).getByRole("button", { name: label }));
      return dialog;
    };
    const openStamps = () => openView("Stamp Masuk");
    const openHistory = () => openView("Hadiah");

    beforeEach(() => {
      api.getLoyaltyMembers.mockReset();
      api.getLoyaltyMembers.mockResolvedValue(history([]));
      api.getLoyaltyStamps.mockReset();
      api.getLoyaltyStamps.mockResolvedValue(history([STAMPED, GIVEN]));
      api.getLoyaltyRedemptions.mockReset();
      api.getLoyaltyRedemptions.mockResolvedValue(history([REDEEMED]));
    });

    it("opens on Member, the first tab, before Stamp Masuk and Hadiah", async () => {
      const dialog = await openStampHistory();

      const views = within(dialog).getByRole("group", { name: "Jenis data stamp card" });
      expect(within(views).getAllByRole("button").map((button) => button.textContent)).toEqual([
        "Member",
        "Stamp Masuk",
        "Hadiah",
      ]);
      expect(within(views).getByRole("button", { name: "Member" })).toHaveAttribute("aria-pressed", "true");
      await waitFor(() => expect(api.getLoyaltyMembers).toHaveBeenCalledWith({ page: 1, perPage: 20, q: "" }));
      expect(api.getLoyaltyStamps).not.toHaveBeenCalled();
    });

    it("lists the stamps given: when, who, which stamp of which card, the nota and the cashier", async () => {
      const dialog = await openStamps();

      const views = within(dialog).getByRole("group", { name: "Jenis data stamp card" });
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
      const dialog = await openStamps();

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

    });

    it("searches by phone and pages through", async () => {
      api.getLoyaltyRedemptions.mockResolvedValue(history([REDEEMED], { total: 25, last_page: 2 }));
      const dialog = await openHistory();
      await within(dialog).findByText("NSK-90");

      fireEvent.click(within(dialog).getByRole("button", { name: "Berikutnya" }));
      await waitFor(() => expect(api.getLoyaltyRedemptions).toHaveBeenLastCalledWith({ page: 2, perPage: 20, q: "" }));

      fireEvent.change(within(dialog).getByLabelText("Cari"), { target: { value: "0812" } });
      await waitFor(() => expect(api.getLoyaltyRedemptions).toHaveBeenLastCalledWith({ page: 1, perPage: 20, q: "0812" }));
    });

    it("says when nothing was handed over yet", async () => {
      api.getLoyaltyRedemptions.mockResolvedValue(history([]));
      const dialog = await openHistory();

      expect(await within(dialog).findByText("Belum ada hadiah yang ditukar.")).toBeInTheDocument();
      expect(within(dialog).queryByRole("button", { name: "Berikutnya" })).not.toBeInTheDocument();
    });

    describe("Member", () => {
      // 12 stamps over two cards (the first full), one reward handed over and
      // one ready; and a member who never got a stamp.
      const MEMBER = {
        id: 4,
        customer: { code: "NSK-000004", name: "Demo Makanan", phone: "62987654321" },
        registered_at: "2026-11-01T09:00:00+07:00",
        total_stamps: 12,
        last_stamp_at: "2026-11-19T12:00:00+07:00",
        cards: 2,
        // Numbered year-month-sequence; valid until 3 months after its first stamp.
        card: { number: "26-11-004", stamps: 2, slots: 10, status: "active", expires_at: "2027-02-19T23:59:59+07:00" },
        rewards_redeemed: 1,
        rewards_ready: 1,
      };
      const NEW_MEMBER = {
        id: 9,
        customer: { code: "NSK-000009", name: null, phone: "6281111111111" },
        registered_at: "2026-11-22T09:00:00+07:00",
        total_stamps: 0,
        last_stamp_at: null,
        cards: 1,
        // No stamp yet: no expiry yet.
        card: { number: "26-11-009", stamps: 0, slots: 10, status: "active", expires_at: null },
        rewards_redeemed: 0,
        rewards_ready: 0,
      };
      // Member is the tab the page opens on.
      const openMembers = openStampHistory;

      beforeEach(() => {
        api.getLoyaltyMembers.mockReset();
        api.getLoyaltyMembers.mockResolvedValue(history([MEMBER, NEW_MEMBER]));
      });

      it("lists every member with all the stamps they earned, their card now and their rewards", async () => {
        const dialog = await openMembers();

        const row = (await within(dialog).findByText("26-11-004")).closest("tr");
        expect(Array.from(row.cells).map((cell) => cell.textContent)).toEqual([
          "0987654321NSK-000004 · Demo Makanan",
          "122 kartu",
          "2/1026-11-004",
          "19/02/2027",
          "1 ditukar1 siap ditukar",
          "19/11/26 12:00",
          "Reset PIN",
        ]);
        const fresh = within(dialog).getByText("26-11-009").closest("tr");
        expect(fresh.cells[1]).toHaveTextContent("01 kartu");
        expect(fresh.cells[3]).toHaveTextContent(/^-$/);
        expect(fresh.cells[5]).toHaveTextContent("Belum ada");
        expect(within(dialog).getByText("2 member")).toBeInTheDocument();
        expect(api.getLoyaltyMembers).toHaveBeenCalledWith({ page: 1, perPage: 20, q: "" });
      });

      it("resets a member's PIN only after Reset PIN is confirmed", async () => {
        api.resetLoyaltyMemberPin.mockReset();
        api.resetLoyaltyMemberPin.mockResolvedValue(answer({ id: 4, own_pin: false }));
        api.getLoyaltyMembers.mockResolvedValue(history([{ ...MEMBER, own_pin: true }, { ...NEW_MEMBER, own_pin: false }]));
        const dialog = await openMembers();
        expect(within(dialog).getByRole("columnheader", { name: "Aksi" })).toBeInTheDocument();

        // Still the first PIN (last 4 digits of the number): nothing to reset.
        expect(await within(dialog).findByRole("button", { name: "Reset PIN 081111111111" })).toBeDisabled();

        const resetButton = within(dialog).getByRole("button", { name: "Reset PIN 0987654321" });
        fireEvent.click(resetButton);
        let confirm = screen.getByRole("dialog", { name: "Reset PIN member?" });
        expect(confirm).toHaveTextContent(
          "PIN 0987654321 (Demo Makanan) kembali ke 4 angka terakhir nomor HP: 4321. Pelanggan membuat PIN baru saat membuka kartu."
        );
        // Batal: nothing is reset.
        fireEvent.click(within(confirm).getByRole("button", { name: "Batal" }));
        expect(screen.queryByRole("dialog", { name: "Reset PIN member?" })).not.toBeInTheDocument();
        expect(api.resetLoyaltyMemberPin).not.toHaveBeenCalled();

        fireEvent.click(resetButton);
        confirm = screen.getByRole("dialog", { name: "Reset PIN member?" });
        fireEvent.click(within(confirm).getByRole("button", { name: "Reset PIN" }));

        expect(await screen.findByText("PIN 0987654321 direset.")).toBeInTheDocument();
        expect(api.resetLoyaltyMemberPin).toHaveBeenCalledTimes(1);
        expect(api.resetLoyaltyMemberPin).toHaveBeenCalledWith(4);
        expect(screen.queryByRole("dialog", { name: "Reset PIN member?" })).not.toBeInTheDocument();
        // The list is read again (own_pin now false).
        await waitFor(() => expect(api.getLoyaltyMembers).toHaveBeenCalledTimes(2));
      });

      it("shows no Aksi to a cashier", async () => {
        renderWithProviders(<MemberStampCard />, { preloadedState: asCashier });
        const page = await screen.findByRole("region", { name: "Member Stamp Card" });

        expect(await within(page).findByText("26-11-004")).toBeInTheDocument();
        expect(within(page).queryByRole("columnheader", { name: "Aksi" })).not.toBeInTheDocument();
        expect(within(page).queryByRole("button", { name: /^Reset PIN/ })).not.toBeInTheDocument();
      });

      it("opens the member's expired and redeemed cards from its kartu count, one line each", async () => {
        api.getLoyaltyMembers.mockResolvedValue(history([{ ...MEMBER, card_history: [
          { number: "26100003", status: "expired", stamps: 3, redemptions: [] },
          { number: "26070002", status: "redeemed", stamps: 10, redemptions: [
            { id: 7, label: "Minuman gratis", redeemed_at: REDEEMED.redeemed_at },
          ] },
        ] }, NEW_MEMBER]));
        const dialog = await openMembers();
        const summary = await within(dialog).findByText("2 kartu");
        expect(summary.tagName).toBe("SUMMARY");
        fireEvent.click(summary);

        const [expired, redeemed] = within(summary.closest("details")).getAllByRole("listitem");
        expect(expired).toHaveTextContent(/^26100003 · Kedaluwarsa · 3 stamp$/);
        expect(expired).not.toHaveAttribute("title");
        expect(redeemed).toHaveTextContent(/^26070002 · Selesai · 10 stamp · 1 hadiah$/);
        // The reward's name and date on hover.
        expect(redeemed).toHaveAttribute("title", "Minuman gratis · 20/11/2026");
        // No past cards: the count is plain text.
        expect(within(dialog).getByText("1 kartu").tagName).toBe("SPAN");
      });

      it("says a full card, its expiry still ahead (not red)", async () => {
        api.getLoyaltyMembers.mockResolvedValue(
          history([{ ...MEMBER, cards: 1, card: { ...MEMBER.card, stamps: 10, status: "completed" } }])
        );
        const dialog = await openMembers();

        expect(await within(dialog).findByText("10/10 · Penuh")).toBeInTheDocument();
        expect(within(dialog).getByText("19/02/2027")).not.toHaveClass("text-red-300");
      });

      it("says an expired card, its date in red, and searches members", async () => {
        api.getLoyaltyMembers.mockResolvedValue(
          history([{ ...MEMBER, cards: 1, card: { ...MEMBER.card, number: "26-08-001", stamps: 10, status: "expired", expires_at: "2026-11-01T23:59:59+07:00" } }])
        );
        const dialog = await openMembers();

        // Past its expiry: the date in red.
        expect(await within(dialog).findByText("10/10 · Kedaluwarsa")).toBeInTheDocument();
        expect(within(dialog).getByText("01/11/2026")).toHaveClass("text-red-300");

        fireEvent.change(within(dialog).getByLabelText("Cari"), { target: { value: "Demo" } });
        await waitFor(() => expect(api.getLoyaltyMembers).toHaveBeenLastCalledWith({ page: 1, perPage: 20, q: "Demo" }));
      });

      it("says when there is no member yet", async () => {
        api.getLoyaltyMembers.mockResolvedValue(history([]));
        const dialog = await openMembers();

        expect(await within(dialog).findByText("Belum ada member.")).toBeInTheDocument();
      });
    });
  });

  it("says when loyalty can't be reached", async () => {
    api.getLoyaltyProgram.mockRejectedValue({ response: { data: { message: "Loyalty sedang tidak tersedia." } } });
    renderWithProviders(<PromoProgramSettings />, { preloadedState: asAdmin });

    expect(await screen.findByRole("alert")).toHaveTextContent("Loyalty sedang tidak tersedia.");
  });
});
