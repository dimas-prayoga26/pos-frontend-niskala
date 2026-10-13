import { configureStore } from "@reduxjs/toolkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { SnackbarProvider } from "notistack";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import cartReducer from "../src/features/pos/cartSlice";
import customerReducer from "../src/redux/slices/customerSlice";
import { userReducer } from "../src/features/auth";

export const createTestStore = (preloadedState) =>
  configureStore({
    reducer: { customer: customerReducer, cart: cartReducer, user: userReducer },
    preloadedState,
  });

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

// Renders `ui` at `route` with the same providers as the app (Redux, React
// Query without retries, notistack, router). The current path is exposed as
// data-testid="location".
export const renderWithProviders = (
  ui,
  { route = "/", path = "*", preloadedState, store = createTestStore(preloadedState) } = {}
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const result = render(
    <Provider store={store}>
      <SnackbarProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path={path} element={ui} />
              <Route path="*" element={null} />
            </Routes>
            <LocationProbe />
          </MemoryRouter>
        </QueryClientProvider>
      </SnackbarProvider>
    </Provider>
  );

  return { ...result, store, queryClient };
};
