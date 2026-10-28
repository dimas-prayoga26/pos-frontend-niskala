import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { useSelector } from "react-redux";
import { getSemiItems, getStockItems } from "../api";
import usePreparedItemActions from "../hooks/usePreparedItemActions";
import useStockItemActions from "../hooks/useStockItemActions";
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
  { key: "semi", label: "Bahan Setengah Jadi" },
];

// Dashboard "Stok" tab: bahan baku (stock_raw_items), purchases (belanja) and
// bahan setengah jadi (stock_semi_items) cooked from bahan baku.
const StockManagement = () => {
  const userRole = useSelector((state) => state.user.role);
  const isAdmin = userRole?.toLowerCase() === "admin";
  const [activeStockTab, setActiveStockTab] = useState("stock");
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingDeleteItem, setPendingDeleteItem] = useState(null);
  const [pendingDeleteSemiItem, setPendingDeleteSemiItem] = useState(null);
  const [editingCogsItem, setEditingCogsItem] = useState(null);
  // null = closed, {} = new semi item, otherwise the item being edited.
  const [editingSemiItem, setEditingSemiItem] = useState(null);
  const [producingItem, setProducingItem] = useState(null);
  const [historyItem, setHistoryItem] = useState(null);
  const [adjustingItem, setAdjustingItem] = useState(null);
  const stockActions = useStockItemActions({
    onDeleted: () => setPendingDeleteItem(null),
    onCogsSaved: () => setEditingCogsItem(null),
  });
  const semiActions = usePreparedItemActions({
    onSaved: () => setEditingSemiItem(null),
    onDeleted: () => setPendingDeleteSemiItem(null),
    onProduced: () => setProducingItem(null),
    onAdjusted: () => setAdjustingItem(null),
  });

  const { data: stockItemsRes, isError } = useQuery({
    queryKey: ["stock-items"],
    queryFn: getStockItems,
    placeholderData: keepPreviousData,
  });
  const { data: semiItemsRes, isError: isSemiError } = useQuery({
    queryKey: ["semi-items"],
    queryFn: getSemiItems,
    placeholderData: keepPreviousData,
  });

  if (isError || isSemiError) {
    enqueueSnackbar("Data stok belum bisa dimuat.", { variant: "error" });
  }

  const stockItems = stockItemsRes?.data?.data || [];
  const semiItems = semiItemsRes?.data?.data || [];
  const isDialogOpen = Boolean(
    pendingDeleteItem ||
      pendingDeleteSemiItem ||
      editingCogsItem ||
      editingSemiItem ||
      producingItem ||
      historyItem ||
      adjustingItem
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
        <ShoppingManagement stockItems={stockItems} isAdmin={isAdmin} />
      )}
      {activeStockTab === "semi" && (
        <PreparedItemsPanel
          preparedItems={semiItems}
          isAdmin={isAdmin}
          onAdd={() => setEditingSemiItem({})}
          onEdit={setEditingSemiItem}
          onProduce={setProducingItem}
          onHistory={setHistoryItem}
          onAdjust={setAdjustingItem}
          onDelete={setPendingDeleteSemiItem}
        />
      )}
      {activeStockTab === "stock" && (
        <StockItemsPanel
          stockItems={stockItems}
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

      {isAdmin && editingSemiItem && (
        <PreparedItemDialog
          item={editingSemiItem.id ? editingSemiItem : null}
          rawItems={stockItems}
          onSave={semiActions.save}
          onCancel={() => setEditingSemiItem(null)}
          isSaving={semiActions.isSaving}
        />
      )}

      {producingItem && (
        <PreparedProductionDialog
          item={producingItem}
          stockItems={stockItems}
          onSave={(payload) => semiActions.produce(producingItem, payload)}
          onCancel={() => setProducingItem(null)}
          isSaving={semiActions.isProducing}
        />
      )}

      {historyItem && (
        <PreparedHistoryDialog
          item={historyItem}
          isAdmin={isAdmin}
          onUndo={semiActions.undoProduction}
          isUndoing={semiActions.isUndoing}
          onClose={() => setHistoryItem(null)}
        />
      )}

      {adjustingItem && (
        <PreparedStockDialog
          item={adjustingItem}
          onSave={(stock) => semiActions.adjustStock(adjustingItem, stock)}
          onCancel={() => setAdjustingItem(null)}
          isSaving={semiActions.isAdjusting}
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

      {isAdmin && pendingDeleteSemiItem && (
        <DeleteStockItemDialog
          item={pendingDeleteSemiItem}
          onConfirm={() => semiActions.deleteItem(pendingDeleteSemiItem)}
          onCancel={() => setPendingDeleteSemiItem(null)}
          isDeleting={semiActions.isDeleting}
        />
      )}
    </div>
  );
};

export default StockManagement;
