import { useQuery } from "@tanstack/react-query";
import { PURCHASE_KINDS } from "../utils/purchaseKinds";

const sameName = (a, b) => String(a || "").toLowerCase() === String(b || "").toLowerCase();

// The per-barang detail (stok, COGS, riwayat with COGS Setelah, log) of a line
// clicked in the Per Nota history: the history list kept to that one barang
// (?itemId=), or found by name when the line lost its barang. It shares the
// history query key, so it refetches after a line is changed.
const usePurchaseItemDetail = (kind = PURCHASE_KINDS.raw, line = null) => {
  const itemId = line?.itemId || null;
  const detail = useQuery({
    queryKey: [kind.historyKey, "item-detail", itemId || line?.itemName || ""],
    queryFn: () => kind.list(itemId ? { itemId, page: 1 } : { search: line.itemName, page: 1 }),
    enabled: Boolean(line),
  });
  const groups = detail.data?.data?.data?.itemGroups || [];
  const group = line
    ? groups.find((candidate) =>
        itemId ? Number(candidate.stockItemId) === Number(itemId) : sameName(candidate.itemName, line.itemName)
      ) || null
    : null;

  return {
    group,
    // Loaded and the barang is not there (its last line was deleted).
    isGone: Boolean(line) && detail.isSuccess && !detail.isFetching && !group,
    isError: Boolean(line) && detail.isError,
  };
};

export default usePurchaseItemDetail;
