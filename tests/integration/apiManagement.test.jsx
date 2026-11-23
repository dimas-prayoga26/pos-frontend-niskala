import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import { SettingsManagement } from "../../src/features/settings";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  getIntegrations: vi.fn(),
  getOrderPlatforms: vi.fn(),
  testIntegration: vi.fn(),
  updateIntegration: vi.fn(),
}));

const asAdmin = { user: { _id: 1, name: "Admin", email: "a", phone: "1", role: "Admin", isAuth: true } };
const asCashier = { user: { _id: 2, name: "Kasir", email: "k", phone: "2", role: "Cashier", isAuth: true } };
const loyalty = (overrides = {}) => ({
  code: "loyalty",
  name: "Loyalty (Stamp Card)",
  baseUrl: "https://loyalty.test/api/pos",
  hasKey: true,
  keyHint: "2bef",
  keyUnreadable: false,
  isActive: true,
  updatedAt: "2026-11-23T10:00:00",
  ...overrides,
});
const answer = (data) => ({ data: { success: true, data } });

const openApi = async () => {
  renderWithProviders(<SettingsManagement />, { preloadedState: asAdmin });
  fireEvent.click(screen.getByRole("button", { name: "API" }));
  return screen.findByRole("region", { name: "Loyalty (Stamp Card)" });
};

describe("settings: API", () => {
  beforeEach(() => {
    api.getOrderPlatforms.mockResolvedValue({ data: { data: [] } });
    api.getIntegrations.mockResolvedValue(answer([loyalty()]));
    api.updateIntegration.mockReset().mockResolvedValue(answer(loyalty()));
    api.testIntegration.mockReset();
  });

  it("is for admins only", () => {
    renderWithProviders(<SettingsManagement />, { preloadedState: asCashier });
    expect(screen.queryByRole("button", { name: "API" })).not.toBeInTheDocument();
  });

  it("shows the loyalty URL and its key censored but its end, in a field that can be typed over", async () => {
    const card = await openApi();

    expect(within(card).getByText("Aktif · key ••••2bef")).toBeInTheDocument();
    expect(within(card).getByLabelText("URL API")).toHaveValue("https://loyalty.test/api/pos");
    const key = within(card).getByLabelText("API Key");
    expect(key).toHaveValue("********************2bef");
    expect(key).not.toHaveAttribute("readonly");
    expect(key).not.toBeDisabled();
    expect(within(card).getByRole("switch", { name: "Loyalty (Stamp Card)" })).toHaveAttribute("aria-checked", "true");
  });

  it("says loyalty is off (not hidden) while there is no key", async () => {
    api.getIntegrations.mockResolvedValue(answer([loyalty({ baseUrl: "", hasKey: false, keyHint: "", isActive: false })]));
    const card = await openApi();

    expect(within(card).getByText("Belum ada API key: semua fitur loyalty dinonaktifkan.")).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Hapus API Key" })).not.toBeInTheDocument();
    expect(within(card).getByLabelText("API Key")).toHaveValue("");
  });

  it("saves a first URL and key, switched on", async () => {
    api.getIntegrations.mockResolvedValue(answer([loyalty({ baseUrl: "", hasKey: false, keyHint: "", isActive: false })]));
    const card = await openApi();

    fireEvent.change(within(card).getByLabelText("URL API"), { target: { value: "https://demo-loyalty.test/api/pos" } });
    fireEvent.change(within(card).getByLabelText("API Key"), { target: { value: "rahasia-123" } });
    fireEvent.click(within(card).getByRole("button", { name: "Simpan" }));

    await waitFor(() =>
      expect(api.updateIntegration).toHaveBeenCalledWith({
        code: "loyalty",
        baseUrl: "https://demo-loyalty.test/api/pos",
        apiKey: "rahasia-123",
        isActive: true,
      })
    );
    expect(await screen.findByText("API disimpan.")).toBeInTheDocument();
  });

  it("keeps the saved key when none is typed", async () => {
    const card = await openApi();

    fireEvent.change(within(card).getByLabelText("URL API"), { target: { value: "https://baru.test/api/pos" } });
    fireEvent.click(within(card).getByRole("button", { name: "Simpan" }));

    await waitFor(() =>
      expect(api.updateIntegration).toHaveBeenCalledWith({
        code: "loyalty",
        baseUrl: "https://baru.test/api/pos",
        isActive: true,
      })
    );
  });

  it("tests the typed values and says how it went", async () => {
    api.testIntegration.mockResolvedValue(answer({ ok: false, message: "Tidak tersambung: Loyalty membalas 401." }));
    const card = await openApi();

    fireEvent.change(within(card).getByLabelText("API Key"), { target: { value: "salah" } });
    fireEvent.click(within(card).getByRole("button", { name: "Tes Koneksi" }));

    expect(await within(card).findByRole("status")).toHaveTextContent("Tidak tersambung: Loyalty membalas 401.");
    expect(api.testIntegration).toHaveBeenCalledWith({
      code: "loyalty",
      baseUrl: "https://loyalty.test/api/pos",
      apiKey: "salah",
    });
    expect(api.updateIntegration).not.toHaveBeenCalled();
  });

  it("removes the key after asking, and switches loyalty off with the switch", async () => {
    const card = await openApi();

    fireEvent.click(within(card).getByRole("button", { name: "Hapus API Key" }));
    expect(api.updateIntegration).not.toHaveBeenCalled();
    fireEvent.click(within(card).getByRole("button", { name: "Hapus" }));
    await waitFor(() =>
      expect(api.updateIntegration).toHaveBeenCalledWith({
        code: "loyalty",
        baseUrl: "https://loyalty.test/api/pos",
        apiKey: null,
        isActive: true,
      })
    );
    expect(await screen.findByText("API key dihapus.")).toBeInTheDocument();

    fireEvent.click(within(card).getByRole("switch", { name: "Loyalty (Stamp Card)" }));
    await waitFor(() =>
      expect(api.updateIntegration).toHaveBeenLastCalledWith({
        code: "loyalty",
        baseUrl: "https://loyalty.test/api/pos",
        isActive: false,
      })
    );
  });
});
