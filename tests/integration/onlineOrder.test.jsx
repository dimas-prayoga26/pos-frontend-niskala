import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import MenuPage from "../../src/features/pos/pages/MenuPage";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  addOrder: vi.fn(),
  getCategories: vi.fn(),
  getMenuItems: vi.fn(),
  getOrderPlatforms: vi.fn(),
}));

describe("Online order", () => {
  beforeEach(() => {
    // jsdom has no scrolling; the cart scrolls to its newest line.
    Element.prototype.scrollTo ??= () => {};
    api.getCategories.mockResolvedValue({ data: { data: [{ id: 1, name: "Coffee" }] } });
    api.getMenuItems.mockResolvedValue({
      data: { data: [{ id: 11, categoryId: 1, name: "Kopi Susu", price: 18000, regularPrice: 18000 }] },
    });
    api.getOrderPlatforms.mockResolvedValue({ data: { data: [{ id: 3, name: "ShopeeFood" }] } });
    api.addOrder.mockReset();
    // The order stays on its way: only what is sent matters here.
    api.addOrder.mockReturnValue(new Promise(() => {}));
  });

  it("asks no Tunai / Non Tunai: the platform is its payment", async () => {
    renderWithProviders(<MenuPage />, { route: "/menu" });
    await screen.findAllByText("Kopi Susu");
    fireEvent.click(screen.getAllByRole("button", { name: "+" })[0]);
    // Picked on Offline first, then switched to Online: no QRIS dialog follows.
    fireEvent.click(screen.getByRole("button", { name: "Non Tunai" }));

    fireEvent.click(screen.getByRole("button", { name: "Online" }));
    expect(screen.queryByRole("button", { name: "Tunai" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Non Tunai" })).not.toBeInTheDocument();

    // The platform is still required.
    const save = screen.getByRole("button", { name: "Place Order" });
    fireEvent.click(save);
    expect(await screen.findByText("Please select online order platform!")).toBeInTheDocument();
    expect(api.addOrder).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Pilih platform" }));
    fireEvent.click(await screen.findByRole("button", { name: "ShopeeFood" }));
    fireEvent.click(save);

    await waitFor(() => expect(api.addOrder).toHaveBeenCalledTimes(1));
    expect(api.addOrder.mock.calls[0][0]).toMatchObject({
      orderType: "Online",
      orderPlatform: "ShopeeFood",
      paymentMethod: "ShopeeFood",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("still asks Tunai / Non Tunai for an Offline order", async () => {
    renderWithProviders(<MenuPage />, { route: "/menu" });
    await screen.findAllByText("Kopi Susu");
    fireEvent.click(screen.getAllByRole("button", { name: "+" })[0]);

    fireEvent.click(screen.getByRole("button", { name: "Place Order" }));
    expect(await screen.findByText("Please select a payment method!")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tunai" }));
    fireEvent.click(screen.getByRole("button", { name: "Place Order" }));
    await waitFor(() => expect(api.addOrder).toHaveBeenCalledTimes(1));
    expect(api.addOrder.mock.calls[0][0]).toMatchObject({ orderType: "Offline", paymentMethod: "Tunai" });
  });
});
