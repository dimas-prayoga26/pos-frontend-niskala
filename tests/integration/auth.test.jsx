import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import { Login } from "../../src/features/auth";
import { renderWithProviders } from "../renderWithProviders";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  login: vi.fn(),
}));

const fillAndSubmit = () => {
  fireEvent.change(screen.getByPlaceholderText("Enter employee email"), {
    target: { value: "kasir@test.local" },
  });
  fireEvent.change(screen.getByPlaceholderText("Enter password"), {
    target: { value: "secret" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
};

describe("login", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("stores the user and opens the home page", async () => {
    api.login.mockResolvedValue({
      data: {
        data: { _id: 2, name: "Kasir", email: "kasir@test.local", phone: "1", role: "Cashier" },
      },
    });
    const { store } = renderWithProviders(<Login />, { route: "/auth" });

    fillAndSubmit();

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/));
    expect(api.login).toHaveBeenCalledWith({ email: "kasir@test.local", password: "secret" });
    expect(store.getState().user).toMatchObject({ _id: 2, role: "Cashier", isAuth: true });
  });

  it("shows the server message and stays on the page when login fails", async () => {
    api.login.mockRejectedValue({ response: { data: { message: "Invalid Credentials" } } });
    const { store } = renderWithProviders(<Login />, { route: "/auth" });

    fillAndSubmit();

    expect(await screen.findByText("Invalid Credentials")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/auth");
    expect(store.getState().user.isAuth).toBe(false);
  });
});
