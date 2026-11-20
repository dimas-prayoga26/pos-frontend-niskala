import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import LoyaltyStatus from "../../src/components/menu/LoyaltyStatus";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  getLoyaltyCustomer: vi.fn(),
  // The POS catalog, where the reward promos are looked up.
  getCategories: vi.fn(async () => ({ data: { data: [] } })),
  getMenuItems: vi.fn(async () => ({ data: { data: [] } })),
}));

const respond = (data) => api.getLoyaltyCustomer.mockResolvedValue({ data: { data } });
// The phone is looked up after a short pause in typing.
const findText = (text) => screen.findByText(text, { exact: false }, { timeout: 2000 });

describe("LoyaltyStatus", () => {
  beforeEach(() => api.getLoyaltyCustomer.mockReset());

  it("shows a new number in green", async () => {
    respond({ registered: false, stamp_min_order_total: 100000 });
    renderWithProviders(<LoyaltyStatus phone="083123555526" />);

    const note = await findText("Nomor baru");
    expect(note.textContent.replace(/\s/g, " ")).toBe("Nomor baru · Stamp untuk order min. Rp 100.000");
    expect(note).toHaveClass("text-green-400");
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
