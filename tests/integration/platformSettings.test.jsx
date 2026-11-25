import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import { SettingsManagement } from "../../src/features/settings";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  addOrderPlatform: vi.fn(),
  getOrderPlatforms: vi.fn(),
  updateOrderPlatform: vi.fn(),
}));

const asAdmin = { user: { _id: 1, name: "Admin", email: "a", phone: "1", role: "Admin", isAuth: true } };
const PLATFORMS = [
  { id: 1, name: "GoFood", tax: 0, isActive: true },
  { id: 2, name: "GrabFood", tax: 0, isActive: true },
];

describe("settings: platform", () => {
  beforeEach(() => {
    api.getOrderPlatforms.mockResolvedValue({ data: { data: PLATFORMS } });
    api.addOrderPlatform.mockReset().mockResolvedValue({ data: { success: true } });
    api.updateOrderPlatform.mockReset().mockResolvedValue({ data: { success: true } });
  });

  it("keeps no platform fee: it is typed per order", async () => {
    renderWithProviders(<SettingsManagement />, { preloadedState: asAdmin });

    const table = (await screen.findByText("GoFood")).closest("table");
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Platform",
      "Status",
      "Aksi",
    ]);
    expect(screen.queryByText(/Biaya Platform/)).not.toBeInTheDocument();
  });

  it("adds and changes a platform with its name and status only", async () => {
    renderWithProviders(<SettingsManagement />, { preloadedState: asAdmin });

    fireEvent.change(screen.getByPlaceholderText("GoFood"), { target: { value: "ShopeeFood" } });
    fireEvent.click(screen.getByRole("button", { name: "Tambah" }));
    await waitFor(() => expect(api.addOrderPlatform).toHaveBeenCalledWith({ name: "ShopeeFood", isActive: true }));

    fireEvent.click((await screen.findAllByRole("button", { name: "Ubah" }))[0]);
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    await waitFor(() =>
      expect(api.updateOrderPlatform).toHaveBeenCalledWith({ platformId: 1, name: "GoFood", isActive: true })
    );
  });
});
