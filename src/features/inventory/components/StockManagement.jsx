import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { useSelector } from "react-redux";
import { getSemiItems, getStockItems } from "../api";
import usePreparedItemActions from "../hooks/usePreparedItemActions";
import useStockItemActions from "../hooks/useStockItemActions";
import useWasteActions from "../hooks/useWasteActions";
import AddStockItemDialog from "./stock/AddStockItemDialog";
import DeleteStockItemDialog from "./stock/DeleteStockItemDialog";
import PreparedHistoryDialog from "./stock/PreparedHistoryDialog";
import PreparedItemDialog from "./stock/PreparedItemDialog";
import PreparedItemsPanel from "./stock/PreparedItemsPanel";
import PreparedProductionDialog from "./stock/PreparedProductionDialog";
import StockCogsDialog from "./stock/StockCogsDialog";
import StockItemsPanel from "./stock/StockItemsPanel";
import WasteDialog from "./stock/WasteDialog";
import WastesPanel from "./stock/WastesPanel";

// "Ubah" (COGS awal) on Bahan Baku is hidden for now; set to true to show it again.
const SHOW_COGS_EDIT = false;

const STOCK_TABS = [
  { key: "stock", label: "Bahan Baku" },
  { key: "semi", label: "Bahan Olahan" },
];

// Dashboard "Stok" menu, what is on hand: bahan baku (stock_raw_items) and
// bahan olahan (stock_semi_items) cooked from bahan baku. Buying them is
// the separate "Belanja" menu, which also shows the barang Lainnya
// (stock_supply_items: peralatan, perlengkapan, promosi, lain-lain). A new
// bahan baku comes from Tambah Belanja, or without stock from Tambah Bahan
// (admins), which also brings back a hidden bahan of the same name. Both tabs
// have Buang per item (Modul 3, with a bukti foto) and a Riwayat Kerugian
// button that shows that tab's own write-offs in place of the list.
// onRestock(items) takes the bahan baku a Catat Masak is short of to Belanja
// Bahan. createItem ({ kind: "raw" | "semi", name }, from the menu form's
// recipe search) opens with Tambah Bahan or Tambah Bahan Olahan for it.
const StockManagement = ({ onRestock, createItem }) => {
  const userRole = useSelector((state) => state.user.role);
  const isAdmin = userRole?.toLowerCase() === "admin";
  const [activeStockTab, setActiveStockTab] = useState(createItem?.kind === "semi" ? "semi" : "stock");
  // The list, or its Riwayat Kerugian ("wastes").
  const [historyView, setHistoryView] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  // Tambah Bahan: null = closed, else { name, recipeOnly, returnTo }.
  // returnTo is the bahan olahan form it was opened from ({ semiItem, form,
  // rowIndex }); a bahan for a recipe is always a Bahan Resep.
  const [addingItem, setAddingItem] = useState(
    createItem?.kind === "raw" ? { name: createItem.name, recipeOnly: true, returnTo: null } : null
  );
  const [pendingDeleteItem, setPendingDeleteItem] = useState(null);
  const [pendingDeleteSemiItem, setPendingDeleteSemiItem] = useState(null);
  const [editingCogsItem, setEditingCogsItem] = useState(null);
  // null = closed, {} = new semi item, otherwise the item being edited.
  const [editingSemiItem, setEditingSemiItem] = useState(createItem?.kind === "semi" ? {} : null);
  // Its form when it comes back from Tambah Bahan, or the name of a new one.
  const [semiDraft, setSemiDraft] = useState(null);
  const [newSemiName, setNewSemiName] = useState(createItem?.kind === "semi" ? createItem.name : "");
  const [producingItem, setProducingItem] = useState(null);
  const [historyItem, setHistoryItem] = useState(null);
  // { kind: "raw" | "semi", item } being thrown away.
  const [wasting, setWasting] = useState(null);
  const showTab = (tab) => {
    setActiveStockTab(tab);
    setHistoryView(null);
  };
  const closeSemiDialog = () => {
    setEditingSemiItem(null);
    setSemiDraft(null);
    setNewSemiName("");
  };
  // A bahan baku the bahan olahan search did not find: Bahan Baku → Tambah
  // Bahan with that name, then back to the form with the new bahan picked.
  const createRawForSemi = (name, form, rowIndex) => {
    setAddingItem({ name, recipeOnly: true, returnTo: { semiItem: editingSemiItem, form, rowIndex } });
    closeSemiDialog();
    showTab("stock");
  };
  const closeAddItem = (created) => {
    const returnTo = addingItem?.returnTo;
    setAddingItem(null);
    if (!returnTo) return;

    const { semiItem, form, rowIndex } = returnTo;
    setSemiDraft(
      created
        ? {
            ...form,
            components: form.components.map((component, index) =>
              index === rowIndex ? { stockItemId: String(created.id || created._id) } : component
            ),
          }
        : form
    );
    setEditingSemiItem(semiItem);
    showTab("semi");
  };
  const stockActions = useStockItemActions({
    onCreated: closeAddItem,
    onDeleted: () => setPendingDeleteItem(null),
    onCogsSaved: () => setEditingCogsItem(null),
  });
  const semiActions = usePreparedItemActions({
    onSaved: closeSemiDialog,
    onDeleted: () => setPendingDeleteSemiItem(null),
    onProduced: () => setProducingItem(null),
  });
  const wasteActions = useWasteActions({ onWasted: () => setWasting(null) });

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
    addingItem ||
      pendingDeleteItem ||
      pendingDeleteSemiItem ||
      editingCogsItem ||
      editingSemiItem ||
      producingItem ||
      historyItem ||
      wasting
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
          <p className="mt-1 text-sm text-[#ababab]">
            Isi gudang: bahan baku dan bahan olahan.
          </p>
        </div>
        <div className="flex w-full shrink-0 gap-2 rounded-lg bg-[#1f1f1f] p-1 sm:w-fit">
          {STOCK_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => showTab(tab.key)}
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

      {activeStockTab === "semi" && !historyView && (
        <PreparedItemsPanel
          preparedItems={semiItems}
          isAdmin={isAdmin}
          onAdd={() => setEditingSemiItem({})}
          onEdit={setEditingSemiItem}
          onProduce={setProducingItem}
          onHistory={setHistoryItem}
          onWaste={(item) => setWasting({ kind: "semi", item })}
          onDelete={setPendingDeleteSemiItem}
          onShowWastes={() => setHistoryView("wastes")}
        />
      )}
      {historyView === "wastes" && (
        <WastesPanel
          kind={activeStockTab === "semi" ? "semi" : "raw"}
          isAdmin={isAdmin}
          onUndo={wasteActions.undoWaste}
          isUndoing={wasteActions.isUndoingWaste}
          onBack={() => setHistoryView(null)}
        />
      )}
      {activeStockTab === "stock" && !historyView && (
        <StockItemsPanel
          stockItems={stockItems}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isAdmin={isAdmin}
          onEditCogs={SHOW_COGS_EDIT ? setEditingCogsItem : undefined}
          onDelete={setPendingDeleteItem}
          onToggleRecipeUse={stockActions.setRecipeUse}
          recipeUsePendingId={stockActions.recipeUsePendingId}
          onWaste={(item) => setWasting({ kind: "raw", item })}
          onShowWastes={() => setHistoryView("wastes")}
          onAdd={isAdmin ? () => setAddingItem({ name: "", recipeOnly: false, returnTo: null }) : undefined}
        />
      )}

      {isAdmin && addingItem && (
        <AddStockItemDialog
          stockItems={stockItems}
          initialName={addingItem.name}
          recipeOnly={addingItem.recipeOnly}
          onSave={stockActions.createItem}
          onCancel={() => closeAddItem(null)}
          isSaving={stockActions.isCreating}
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
          initialForm={semiDraft}
          initialName={newSemiName}
          rawItems={stockItems}
          onSave={semiActions.save}
          onCancel={closeSemiDialog}
          onCreateRawItem={createRawForSemi}
          isSaving={semiActions.isSaving}
        />
      )}

      {producingItem && (
        <PreparedProductionDialog
          item={producingItem}
          stockItems={stockItems}
          onSave={(payload) => semiActions.produce(producingItem, payload)}
          onSaveStandard={(payload) => semiActions.saveStandard(producingItem, payload)}
          onCancel={() => setProducingItem(null)}
          onRestock={onRestock}
          isSaving={semiActions.isProducing || semiActions.isSavingStandard}
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

      {wasting && (
        <WasteDialog
          item={wasting.item}
          isAdmin={isAdmin}
          onSave={(payload) => wasteActions.waste(wasting.kind, wasting.item, payload)}
          onCancel={() => setWasting(null)}
          isSaving={wasteActions.isWasting}
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
