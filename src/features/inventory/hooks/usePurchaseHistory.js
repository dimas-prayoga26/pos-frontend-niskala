import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { rangeParams } from "../utils/periods";
import { PURCHASE_KINDS } from "../utils/purchaseKinds";
import { HISTORY_PAGE_SIZE } from "../utils/shopping";

const NO_ROWS = [];
const groupKey = (group) => String(group.stockItemId || group.itemName);

// Paged, searchable purchase history of one Jenis Belanja (PURCHASE_KINDS),
// optionally of one kategori (barang Lainnya) and of a period (range: from/to),
// in one of two views:
// - "nota" (Per Struk): posted nota with their barang, plus the count and
//   Grand Total of every matching nota (TOTAL PENGELUARAN, all pages);
// - "item" (Per Bahan / Per Barang): one group per item, its purchases newest
//   first, and the group whose detail dialog is open (kept in sync with
//   refetched data).
const usePurchaseHistory = (kind = PURCHASE_KINDS.raw, { category = "", view = "nota", range = {} } = {}) => {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const isNota = view === "nota";
  const period = rangeParams(range);

  const history = useQuery({
    queryKey: [kind.historyKey, view, category, period.from || "", period.to || "", search, page],
    queryFn: () => (isNota ? kind.listNotas : kind.list)({ search, page, ...(category && { category }), ...period }),
    // Keep showing the rows while another page, search or period loads, but
    // never those of another view, Jenis Belanja or kategori.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey.slice(0, 3).join("|") === [kind.historyKey, view, category].join("|")
        ? previous
        : undefined,
  });
  const historyData = history.data?.data?.data;
  const notas = (isNota && historyData?.notas) || NO_ROWS;
  const itemGroups = (!isNota && historyData?.itemGroups) || NO_ROWS;
  const notaCount = isNota ? Number(historyData?.total || 0) : 0;
  const totalSpending = isNota ? historyData?.totalSpending ?? null : null;
  const rowCount = isNota ? historyData?.total : historyData?.groupTotal;
  const totalPages = Math.max(1, Math.ceil(Number(rowCount || 0) / HISTORY_PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // Replace the open group with its refetched version; close it if it vanished.
  useEffect(() => {
    if (!selectedGroup) return;

    const freshGroup = itemGroups.find((group) => groupKey(group) === groupKey(selectedGroup));

    if (freshGroup) {
      setSelectedGroup(freshGroup);
    } else if (!history.isFetching) {
      setSelectedGroup(null);
    }
  }, [history.isFetching, itemGroups, selectedGroup]);

  return {
    history,
    notas,
    notaCount,
    totalSpending,
    itemGroups,
    page,
    setPage,
    totalPages,
    search,
    changeSearch: (value) => {
      setSearch(value);
      setPage(1);
    },
    selectedGroup,
    setSelectedGroup,
  };
};

export default usePurchaseHistory;
