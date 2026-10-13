import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getPurchases } from "../api";
import { HISTORY_PAGE_SIZE, buildFallbackItemGroups } from "../utils/shopping";

const groupKey = (group) => String(group.stockItemId || group.itemName);

// Paged, searchable purchase history grouped per item, plus the item whose
// detail dialog is open (kept in sync with refetched data).
const usePurchaseHistory = (stockItems) => {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedGroup, setSelectedGroup] = useState(null);

  const history = useQuery({
    queryKey: ["purchases", search, page],
    queryFn: () => getPurchases({ search, page }),
    placeholderData: keepPreviousData,
  });
  const historyData = history.data?.data?.data;
  const itemGroups = useMemo(
    () =>
      historyData?.itemGroups || buildFallbackItemGroups(historyData?.purchases || [], stockItems),
    [historyData, stockItems]
  );
  const totalPages = Math.max(
    1,
    Math.ceil((historyData?.groupTotal || historyData?.total || 0) / HISTORY_PAGE_SIZE)
  );

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
