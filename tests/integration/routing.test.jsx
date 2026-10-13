import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SnackbarProvider } from "notistack";
import { Provider } from "react-redux";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import AppRoutes from "../../src/app/router/AppRoutes";
import { createTestStore } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  getUserData: vi.fn(),
  getOrders: vi.fn(),
  getMenuItems: vi.fn(),
  logout: vi.fn(),
}));

const Location = () => <div data-testid="location">{useLocation().pathname}</div>;

const renderApp = (route) => {
  const store = createTestStore();
  render(
    <Provider store={store}>
      <SnackbarProvider>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MemoryRouter initialEntries={[route]}>
            <AppRoutes />
            <Location />
          </MemoryRouter>
        </QueryClientProvider>
      </SnackbarProvider>
    </Provider>
  );
  return store;
};

const cashier = { _id: 2, name: "Kasir Uji", email: "k@test", phone: "1", role: "Cashier" };

describe("app routing", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    api.getOrders.mockResolvedValue({ data: { data: [] } });
    api.getMenuItems.mockResolvedValue({ data: { data: [] } });
  });

  it("sends visitors without a session to the login page without the header", async () => {
    api.getUserData.mockRejectedValue({ response: { status: 401 } });
    renderApp("/orders");

    expect(await screen.findByText("Employee Login")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/auth");
    expect(screen.queryByAltText("Niskala Coffee logo")).not.toBeInTheDocument();
  });

  it("restores the session, shows the header and redirects /auth home", async () => {
    api.getUserData.mockResolvedValue({ data: { data: cashier } });
    const store = renderApp("/auth");

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/));
    expect(store.getState().user).toMatchObject({ name: "Kasir Uji", isAuth: true });
    expect(screen.getByAltText("Niskala Coffee logo")).toBeInTheDocument();
    expect(screen.getByText("Kasir Uji")).toBeInTheDocument();
  });

  it("logs out from the header", async () => {
    api.getUserData.mockResolvedValueOnce({ data: { data: cashier } });
    api.getUserData.mockRejectedValue({ response: { status: 401 } });
    api.logout.mockResolvedValue({ data: { success: true } });
    const store = renderApp("/");

    await screen.findByAltText("Niskala Coffee logo");
    // The logout control is the last icon in the header (an svg without a label).
    const headerIcons = document.querySelectorAll("header svg");
    fireEvent.click(headerIcons[headerIcons.length - 1]);
    await waitFor(() => expect(api.logout).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/auth"));
    expect(store.getState().user.isAuth).toBe(false);
  });

  it("renders the not-found route", async () => {
    api.getUserData.mockResolvedValue({ data: { data: cashier } });
    renderApp("/tidak-ada");

    expect(await screen.findByText("Not Found")).toBeInTheDocument();
  });
});
