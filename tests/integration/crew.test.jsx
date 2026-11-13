import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const atJakartaTime = (time) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`2026-11-13T${time}:00+07:00`));
};

describe("Konsumsi Crew", () => {
  beforeEach(() => {
    // jsdom has no scrolling; the cart scrolls to its newest line.
    Element.prototype.scrollTo ??= () => {};
    api.getCategories.mockResolvedValue({ data: { data: [{ id: 1, name: "Coffee", taxRate: 10 }] } });
    api.getMenuItems.mockResolvedValue({
      data: { data: [{ id: 11, categoryId: 1, name: "Kopi Susu", price: 18000, regularPrice: 18000 }] },
    });
    api.getOrderPlatforms.mockResolvedValue({ data: { data: [] } });
    // The order stays on its way: only what is sent matters here.
    api.addOrder.mockReturnValue(new Promise(() => {}));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the Crew order type off before 12:00", async () => {
    atJakartaTime("11:59");
    renderWithProviders(<MenuPage />, { route: "/menu" });

    expect(await screen.findByRole("button", { name: "Crew" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Crew" })).toHaveAttribute("title", "Mulai jam 12:00");
  });

  it("saves a crew member's meal for free: their name, no payment, Rp 0", async () => {
    atJakartaTime("12:30");
    const { store } = renderWithProviders(<MenuPage />, { route: "/menu" });
    await screen.findAllByText("Kopi Susu");
    fireEvent.click(screen.getAllByRole("button", { name: "+" })[0]);
    expect(store.getState().cart).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Crew" }));
    expect(screen.getByLabelText("Nama Crew")).toHaveAttribute("placeholder", "Nama crew");
    expect(screen.queryByText("Nomor Telepon")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tunai" })).not.toBeInTheDocument();
    expect(screen.getByText("Konsumsi Crew")).toBeInTheDocument();

    const save = screen.getByRole("button", { name: "Place Order" });
    fireEvent.click(save);
    expect(await screen.findByText("Isi nama crew dulu.")).toBeInTheDocument();
    expect(api.addOrder).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Nama Crew"), { target: { value: "Budi" } });
    fireEvent.click(save);
    await waitFor(() => expect(api.addOrder).toHaveBeenCalled());
    expect(api.addOrder.mock.calls[0][0]).toMatchObject({
      orderType: "Crew",
      paymentMethod: "Crew",
      customerDetails: { name: "Budi", phone: "" },
      bills: { total: 0, tax: 0, totalWithTax: 0 },
    });
  });
});
