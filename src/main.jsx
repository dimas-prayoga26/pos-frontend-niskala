import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { Provider } from "react-redux";
import store from "./redux/store.js";
import { SnackbarProvider } from "notistack";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const rawQueryRefetchInterval = import.meta.env.VITE_QUERY_REFETCH_INTERVAL_MS;
const parsedQueryRefetchInterval = Number(rawQueryRefetchInterval);
const queryRefetchInterval =
  rawQueryRefetchInterval === undefined || rawQueryRefetchInterval === ""
    ? 15000
    : Number.isFinite(parsedQueryRefetchInterval)
      ? parsedQueryRefetchInterval
      : 15000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      refetchInterval: queryRefetchInterval > 0 ? queryRefetchInterval : false,
      refetchOnWindowFocus: "always",
      refetchOnReconnect: "always",
    },
  },
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Provider store={store}>
      <SnackbarProvider autoHideDuration={3000}>
        <QueryClientProvider client={queryClient} >
          <App />
        </QueryClientProvider>
      </SnackbarProvider>
    </Provider>
  </StrictMode>
);
