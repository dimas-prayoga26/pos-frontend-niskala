import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getShoppingSuppliers } from "../api";
import usePurchaseForm from "../hooks/usePurchaseForm";
import usePurchaseHistory from "../hooks/usePurchaseHistory";
import usePurchaseItemActions from "../hooks/usePurchaseItemActions";
import PurchaseFormDialog from "./shopping/PurchaseFormDialog";
import PurchaseHistoryDialog from "./shopping/PurchaseHistoryDialog";
import PurchaseHistoryTable from "./shopping/PurchaseHistoryTable";
import PurchaseItemEditDialog from "./shopping/PurchaseItemEditDialog";
import { buttonClass, inputClass } from "./shopping/styles";

// Purchases (belanja) per item: searchable history, detail/log dialog and the
// admin-only purchase form. See SHOPPING.md in pos-backend for the rules.
export default function ShoppingManagement({ stockItems, isAdmin }) {
  const [showForm, setShowForm] = useState(false);
  const suppliers = useQuery({
    queryKey: ["shopping-suppliers"],
    queryFn: getShoppingSuppliers,
  });
  const historyState = usePurchaseHistory(stockItems);
  const { history, itemGroups, page, setPage, totalPages, selectedGroup, setSelectedGroup } =
    historyState;
  const itemActions = usePurchaseItemActions();
  const purchaseForm = usePurchaseForm({
    suppliers: suppliers.data?.data?.data || [],
    stockItems,
    onSaved: () => {
      setShowForm(false);
      setPage(1);
    },
  });
  const { editingItem, setEditingItem } = itemActions;

  // Lock page scrolling while any dialog is open.
  useEffect(() => {
    if (!showForm && !selectedGroup && !editingItem) return undefined;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [showForm, selectedGroup, editingItem]);

  const closeHistoryDetail = useCallback(() => {
    setSelectedGroup(null);
    setEditingItem(null);
  }, [setEditingItem, setSelectedGroup]);

  return (
    <section className="mb-5 rounded-lg bg-[#1f1f1f] p-4 text-[#f5f5f5]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">Bahan Belanjaan</h3>
          <p className="mt-1 text-sm text-[#ababab]">Riwayat belanja dikelompokkan per bahan.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {isAdmin && (
            <button
              className={`${buttonClass} whitespace-nowrap`}
              onClick={() => setShowForm(true)}
              type="button"
            >
              Tambah Bahan Belanjaan
            </button>
          )}
          <input
            className={`${inputClass} sm:w-64`}
            type="search"
            aria-label="Cari riwayat belanja"
            placeholder="Nama toko atau barang"
            value={historyState.search}
            onChange={(event) => historyState.changeSearch(event.target.value)}
          />
        </div>
      </div>

      {history.isError && (
        <p role="alert" className="text-red-400">
          Riwayat belanja gagal dimuat.{" "}
          <button onClick={() => history.refetch()} className="underline" type="button">
            Coba lagi
          </button>
        </p>
      )}
      {history.isPending && <p>Memuat riwayat belanja...</p>}
      {!history.isPending && !history.isError && !itemGroups.length && (
        <p className="py-5 text-center text-[#ababab]">Belum ada belanja tersimpan.</p>
      )}

      {!history.isPending && !history.isError && itemGroups.length > 0 && (
        <PurchaseHistoryTable itemGroups={itemGroups} onOpen={setSelectedGroup} />
      )}

      <div className="mt-4 flex items-center justify-end gap-3 text-sm">
        <button
          disabled={page <= 1 || history.isFetching}
          onClick={() => setPage((current) => current - 1)}
          className="disabled:opacity-40"
          type="button"
        >
          Sebelumnya
        </button>
        <span>
          {page} / {totalPages}
        </span>
        <button
          disabled={page >= totalPages || history.isFetching}
          onClick={() => setPage((current) => current + 1)}
          className="disabled:opacity-40"
          type="button"
        >
          Berikutnya
        </button>
      </div>

      {selectedGroup && (
        <PurchaseHistoryDialog
          group={selectedGroup}
          isAdmin={isAdmin}
          onClose={closeHistoryDetail}
          onEditItem={itemActions.startEdit}
          onDeleteItem={itemActions.removeItem}
          isDeleting={itemActions.isDeleting}
        />
      )}

      {editingItem && (
        <PurchaseItemEditDialog
          itemName={editingItem.itemName || selectedGroup?.itemName}
          form={itemActions.editForm}
          onChange={(patch) => itemActions.setEditForm((current) => ({ ...current, ...patch }))}
          onSubmit={itemActions.submitEdit}
          onClose={() => setEditingItem(null)}
          isSaving={itemActions.isSaving}
        />
      )}

      {showForm && (
        <PurchaseFormDialog purchaseForm={purchaseForm} onClose={() => setShowForm(false)} />
      )}
    </section>
  );
}
