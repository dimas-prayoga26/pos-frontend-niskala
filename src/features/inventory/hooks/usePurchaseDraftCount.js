import { useQuery } from "@tanstack/react-query";
import { PURCHASE_KINDS } from "../utils/purchaseKinds";

// Draft nota waiting to be posted, for the badge of the "Belanja" menu. Shares
// its queries (and their realtime refresh) with the drafts panel.
const usePurchaseDraftCount = () => {
  const raw = useQuery({ queryKey: ["purchase-drafts", "raw"], queryFn: PURCHASE_KINDS.raw.listDrafts });
  const supply = useQuery({ queryKey: ["purchase-drafts", "supply"], queryFn: PURCHASE_KINDS.supply.listDrafts });

  return (raw.data?.data?.data?.length || 0) + (supply.data?.data?.data?.length || 0);
};

export default usePurchaseDraftCount;
