import { useQuery } from "@tanstack/react-query";
import { getIntegrationStatus } from "../../https";

export const INTEGRATION_STATUS_KEY = ["integration-status"];

// Loyalty set up in Pengaturan → API (a key, switched on). Off, every loyalty
// screen hides: the stamp card in Menu → Promo, Hadiah Stamp Card in the
// promo form, the stamp box at the cashier. { enabled, known }: known once
// the server answered.
export default function useLoyaltyEnabled() {
  const { data, isSuccess, isError } = useQuery({
    queryKey: INTEGRATION_STATUS_KEY,
    queryFn: getIntegrationStatus,
    staleTime: 60 * 1000,
    retry: false,
  });

  return { enabled: data?.data?.data?.loyalty === true, known: isSuccess || isError };
}
