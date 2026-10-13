import { QueryClient } from "@tanstack/react-query";

// Default polling interval for server data; VITE_QUERY_REFETCH_INTERVAL_MS=0
// disables polling (realtime events still invalidate queries).
const rawQueryRefetchInterval = import.meta.env.VITE_QUERY_REFETCH_INTERVAL_MS;
const parsedQueryRefetchInterval = Number(rawQueryRefetchInterval);
const queryRefetchInterval =
  rawQueryRefetchInterval === undefined || rawQueryRefetchInterval === ""
    ? 15000
    : Number.isFinite(parsedQueryRefetchInterval)
      ? parsedQueryRefetchInterval
      : 15000;

// An expired session (401) is not retried; useLoadSession sends the user to /auth.
const shouldRetryQuery = (failureCount, error) => {
  if (error?.response?.status === 401) return false;

  return failureCount < 3;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryQuery,
      staleTime: 5000,
      refetchInterval: queryRefetchInterval > 0 ? queryRefetchInterval : false,
      refetchOnWindowFocus: "always",
      refetchOnReconnect: "always",
    },
  },
});
