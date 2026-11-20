import { act, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import LoyaltyStatus from "../../src/components/menu/LoyaltyStatus";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  getLoyaltyCustomer: vi.fn(),
  getLoyaltyProgram: vi.fn(),
  // The POS catalog, where the reward promos are looked up.
  getCategories: vi.fn(async () => ({ data: { data: [] } })),
  getMenuItems: vi.fn(async () => ({ data: { data: [] } })),
}));

const respond = (data) => api.getLoyaltyCustomer.mockResolvedValue({ data: { data } });
// Pengaturan → Program Promo: the stamp card on or off.
const stampCard = (active) =>
  api.getLoyaltyProgram.mockResolvedValue({ data: { success: true, data: { code: "stamp_card", active } } });
// The phone is looked up after a short pause in typing.
const findText = (text) => screen.findByText(text, { exact: false }, { timeout: 2000 });

describe("LoyaltyStatus", () => {
  beforeEach(() => {
    api.getLoyaltyCustomer.mockReset();
    api.getLoyaltyProgram.mockReset();
    stampCard(true);
  });

  it("shows a new number in green", async () => {
    respond({ registered: false, stamp_min_order_total: 100000 });
    renderWithProviders(<LoyaltyStatus phone="083123555526" />);

    const note = await findText("Nomor baru");
    expect(note.textContent.replace(/\s/g, " ")).toBe("Nomor baru · Stamp untuk order min. Rp 100.000");
    expect(note).toHaveClass("text-green-400");
  });

  it("doesn't look the number up while the stamp card is switched off in Program Promo", async () => {
    stampCard(false);
    respond({ registered: false, stamp_min_order_total: 100000 });
    const { container } = renderWithProviders(<LoyaltyStatus phone="083123555526" />);

    await waitFor(() => expect(api.getLoyaltyProgram).toHaveBeenCalled());
    // Past the typing pause: still no lookup, nothing drawn.
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(api.getLoyaltyCustomer).not.toHaveBeenCalled();
    expect(screen.queryByText("Mengecek loyalty…")).not.toBeInTheDocument();
    expect(container.querySelector("p")).toBeNull();
  });

  it("looks the number up again once the stamp card is switched back on", async () => {
    stampCard(false);
    respond({ registered: false, stamp_min_order_total: 100000 });
    const { queryClient } = renderWithProviders(<LoyaltyStatus phone="083123555526" />);
    await waitFor(() => expect(api.getLoyaltyProgram).toHaveBeenCalled());

    // What Pengaturan → Program Promo does after the switch.
    act(() => queryClient.setQueryData(["loyalty-program"], { data: { success: true, data: { active: true } } }));

    expect(await findText("Nomor baru")).toBeInTheDocument();
    expect(api.getLoyaltyCustomer).toHaveBeenCalledWith("083123555526");
  });

  it("says when loyalty can't be reached", async () => {
    api.getLoyaltyProgram.mockRejectedValue({ response: { data: { message: "Loyalty sedang tidak tersedia." } } });
    renderWithProviders(<LoyaltyStatus phone="083123555526" />);

    expect(await findText("Loyalty sedang tidak tersedia.")).toBeInTheDocument();
    expect(api.getLoyaltyCustomer).not.toHaveBeenCalled();
  });

  it("shows a registered number in the Niskala logo color", async () => {
    respond({
      registered: true,
      stamp_min_order_total: 100000,
      customer: { code: "NSK-000001" },
      card: { stamps: 3, slots: 10 },
      next_reward: { remaining: 2, label: "Minuman gratis" },
      ready_rewards: [],
    });
    renderWithProviders(<LoyaltyStatus phone="083123555526" />);

    const code = await findText("NSK-000001");
    const box = code.closest("div").parentElement;
    expect(box).toHaveClass("text-[#AFA087]");
    expect(box).not.toHaveClass("text-green-400");
    expect(screen.getByText("3/10 stamp")).toBeInTheDocument();
    expect(screen.getByText("2 stamp lagi · Minuman gratis")).toBeInTheDocument();
    expect(screen.getByText("Stamp untuk order min. Rp 100.000", { normalizer: (text) => text.replace(/\s/g, " ") })).toBeInTheDocument();
  });

  it("says when the number already had its stamp today", async () => {
    respond({
      registered: true,
      stamp_min_order_total: 100000,
      customer: { code: "NSK-000001" },
      card: { stamps: 3, slots: 10 },
      next_reward: { remaining: 2, label: "Minuman gratis" },
      ready_rewards: [],
      daily_limit_reached: true,
    });
    renderWithProviders(<LoyaltyStatus phone="083123555526" />);

    expect(await findText("Sudah dapat stamp hari ini")).toBeInTheDocument();
    expect(screen.queryByText(/Stamp untuk order min\./)).not.toBeInTheDocument();
  });
});
