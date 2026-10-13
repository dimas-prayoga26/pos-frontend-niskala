import { QueryClientProvider } from "@tanstack/react-query";
import { SnackbarProvider } from "notistack";
import { Provider } from "react-redux";
import { queryClient } from "../queryClient";
import store from "../store";

const AppProviders = ({ children }) => (
  <Provider store={store}>
    <SnackbarProvider autoHideDuration={3000}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SnackbarProvider>
  </Provider>
);

export default AppProviders;
