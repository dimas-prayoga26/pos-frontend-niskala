import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { useSelector } from "react-redux";
import { getStockItems } from "../api";
import usePreparedItemActions from "../hooks/usePreparedItemActions";
import useStockItemActions from "../hooks/useStockItemActions";
import { isPreparedItem } from "../utils/preparedItems";
import ShoppingManagement from "./ShoppingManagement";
import DeleteStockItemDialog from "./stock/DeleteStockItemDialog";
import PreparedHistoryDialog from "./stock/PreparedHistoryDialog";
import PreparedItemDialog from "./stock/PreparedItemDialog";
import PreparedItemsPanel from "./stock/PreparedItemsPanel";
import PreparedProductionDialog from "./stock/PreparedProductionDialog";
import PreparedStockDialog from "./stock/PreparedStockDialog";
import StockCogsDialog from "./stock/StockCogsDialog";
import StockItemsPanel from "./stock/StockItemsPanel";

const STOCK_TABS = [
  { key: "stock", label: "Stok Barang" },
  { key: "shopping", label: "Bahan Belanjaan" },
  { key: "prepared", label: "Bahan Olahan" },
];

// Dashboard "Stok" tab: raw stock items, purchases (belanja) and prepared
// items (bahan olahan) cooked from raw items.
const StockManagement = () => {
  const userRole = useSelector((state) => state.user.role);
  const isAdmin = userRole?.toLowerCase() === "admin";
  const [activeStockTab, setActiveStockTab] = useState("stock");
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingDeleteItem, setPendingDeleteItem] = useState(null);
  const [editingCogsItem, setEditingCogsItem] = useState(null);
  // null = closed, {} = new prepared item, otherwise the item being edited.
  const [editingPreparedItem, setEditingPreparedItem] = useState(null);
  const [producingItem, setProducingItem] = useState(null);
  const [historyItem, setHistoryItem] = useState(null);
  const [adjustingItem, setAdjustingItem] = useState(null);
  const stockActions = useStockItemActions({
    onDeleted: () => setPendingDeleteItem(null),
    onCogsSaved: () => setEditingCogsItem(null),
  });
  const preparedActions = usePreparedItemActions({
    onSaved: () => setEditingPreparedItem(null),
    onProduced: () => setProducingItem(null),
    onAdjusted: () => setAdjustingItem(null),
  });

  const { data: stockItemsRes, isError } = useQuery({
    queryKey: ["stock-items"],
    queryFn: getStockItems,
    placeholderData: keepPreviousData,
  });

  if (isError) {
    enqueueSnackbar("Data stok belum bisa dimuat.", { variant: "error" });
  }

  const stockItems = useMemo(() => stockItemsRes?.data?.data || [], [stockItemsRes]);
  // Prepared items are cooked, not bought: they get their own tab.
  const rawItems = useMemo(() => stockItems.filter((item) => !isPreparedItem(item)), [stockItems]);
  const preparedItems = useMemo(() => stockItems.filter(isPreparedItem), [stockItems]);
  const isDialogOpen = Boolean(
    pendingDeleteItem || editingCogsItem || editingPreparedItem || producingItem || historyItem || adjustingItem
  );

  // Lock page scrolling while a dialog is open.
  useEffect(() => {
    if (!isDialogOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isDialogOpen]);

  return (
    <div className="container mx-auto bg-[#262626] p-4 rounded-lg">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-[#f5f5f5] text-xl font-semibold">Stok Management</h2>
          <p className="mt-1 text-sm text-[#ababab]">Pantau stok bahan dan status restock.</p>
        </div>
        <div className="flex w-full shrink-0 gap-2 rounded-lg bg-[#1f1f1f] p-1 sm:w-fit">
          {STOCK_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveStockTab(tab.key)}
              className={`flex flex-1 items-center justify-center rounded-md px-4 py-2 text-sm font-bold transition sm:flex-none ${
                activeStockTab === tab.key
                  ? "bg-[#a79981] text-[#101010]"
                  : "text-[#ababab] hover:bg-[#2f2f2f] hover:text-[#f5f5f5]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeStockTab === "shopping" && (
        <ShoppingManagement stockItems={rawItems} isAdmin={isAdmin} />
      )}
      {activeStockTab === "prepared" && (
        <PreparedItemsPanel
          preparedItems={preparedItems}
          isAdmin={isAdmin}
          onAdd={() => setEditingPreparedItem({})}
          onEdit={setEditingPreparedItem}
          onProduce={setProducingItem}
          onHistory={setHistoryItem}
          onAdjust={setAdjustingItem}
          onDelete={setPendingDeleteItem}
        />
      )}
      {activeStockTab === "stock" && (
        <StockItemsPanel
          stockItems={rawItems}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isAdmin={isAdmin}
          onEditCogs={setEditingCogsItem}
          onDelete={setPendingDeleteItem}
        />
      )}

      {isAdmin && editingCogsItem && (
        <StockCogsDialog
          item={editingCogsItem}
          onSave={(values) => stockActions.saveCogs(editingCogsItem, values)}
          onCancel={() => setEditingCogsItem(null)}
          isSaving={stockActions.isSavingCogs}
        />
      )}

      {isAdmin && editingPreparedItem && (
        <PreparedItemDialog
          item={editingPreparedItem.id ? editingPreparedItem : null}
          rawItems={rawItems}
          onSave={preparedActions.save}
          onCancel={() => setEditingPreparedItem(null)}
          isSaving={preparedActions.isSaving}
        />
      )}

      {producingItem && (
        <PreparedProductionDialog
          item={producingItem}
          stockItems={rawItems}
          onSave={(payload) => preparedActions.produce(producingItem, payload)}
          onCancel={() => setProducingItem(null)}
          isSaving={preparedActions.isProducing}
        />
      )}

      {historyItem && (
        <PreparedHistoryDialog
          item={historyItem}
          isAdmin={isAdmin}
          onUndo={preparedActions.undoProduction}
          isUndoing={preparedActions.isUndoing}
          onClose={() => setHistoryItem(null)}
        />
      )}

      {adjustingItem && (
        <PreparedStockDialog
          item={adjustingItem}
          onSave={(stock) => preparedActions.adjustStock(adjustingItem, stock)}
          onCancel={() => setAdjustingItem(null)}
          isSaving={preparedActions.isAdjusting}
        />
      )}

      {isAdmin && pendingDeleteItem && (
        <DeleteStockItemDialog
          item={pendingDeleteItem}
          onConfirm={() => stockActions.deleteItem(pendingDeleteItem)}
          onCancel={() => setPendingDeleteItem(null)}
          isDeleting={stockActions.isDeleting}
        />
      )}
    </div>
  );
};

export default StockManagement;
