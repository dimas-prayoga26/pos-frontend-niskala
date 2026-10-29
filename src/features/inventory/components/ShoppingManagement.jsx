import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPaymentSources, getShoppingSuppliers } from "../api";
import usePurchaseForm from "../hooks/usePurchaseForm";
import usePurchaseHistory from "../hooks/usePurchaseHistory";
import usePurchaseItemActions from "../hooks/usePurchaseItemActions";
import { PURCHASE_KINDS, PURCHASE_KIND_LIST } from "../utils/purchaseKinds";
import PurchaseDraftsPanel from "./shopping/PurchaseDraftsPanel";
import PurchaseFormDialog from "./shopping/PurchaseFormDialog";
import PurchaseHistoryDialog from "./shopping/PurchaseHistoryDialog";
import PurchaseHistoryTable from "./shopping/PurchaseHistoryTable";
import PurchaseItemEditDialog from "./shopping/PurchaseItemEditDialog";
import PurchaseReceiptsDialog from "./shopping/PurchaseReceiptsDialog";
import { buttonClass, inputClass } from "./shopping/styles";

const NO_SOURCES = [];
const NO_ITEMS = [];

// The one place for belanja (the "Belanja" menu): the "Tambah Belanja" form for both Jenis
// Belanja (bahan baku, perlengkapan), the draft nota waiting to be posted, and
// the searchable history per item with its detail/log dialog. Every staff
// member may save a draft; only admins post. See SHOPPING.md in pos-backend.
export default function ShoppingManagement({ stockItems, supplyItems = NO_ITEMS, isAdmin }) {
  const [showForm, setShowForm] = useState(false);
  const [historyKindKey, setHistoryKindKey] = useState("raw");
  const historyKind = PURCHASE_KINDS[historyKindKey];
  const [receiptPurchaseId, setReceiptPurchaseId] = useState(null);
  // Bukti of a draft nota: { kind, id }.
  const [draftReceipts, setDraftReceipts] = useState(null);
  const suppliers = useQuery({
    queryKey: ["shopping-suppliers"],
    queryFn: getShoppingSuppliers,
  });
  // Active sources; kasir get them without saldo.
  const paymentSources = useQuery({
    queryKey: ["payment-sources", "active"],
    queryFn: () => getPaymentSources(),
  });
  const rawDrafts = useQuery({ queryKey: ["purchase-drafts", "raw"], queryFn: PURCHASE_KINDS.raw.listDrafts });
  const supplyDrafts = useQuery({ queryKey: ["purchase-drafts", "supply"], queryFn: PURCHASE_KINDS.supply.listDrafts });
  const drafts = useMemo(
    () =>
      [...(rawDrafts.data?.data?.data || []), ...(supplyDrafts.data?.data?.data || [])].sort((a, b) =>
        String(b.createdAt).localeCompare(String(a.createdAt))
      ),
    [rawDrafts.data, supplyDrafts.data]
  );
  const historyState = usePurchaseHistory(stockItems, historyKind);
  const { history, itemGroups, page, setPage, totalPages, selectedGroup, setSelectedGroup } =
    historyState;
  const itemActions = usePurchaseItemActions(historyKind);
  const showHistoryOf = (kindKey) => {
    setHistoryKindKey(kindKey);
    setSelectedGroup(null);
    setPage(1);
  };
  const purchaseForm = usePurchaseForm({
    suppliers: suppliers.data?.data?.data || [],
    stockItems,
    supplyItems,
    paymentSources: paymentSources.data?.data?.data || NO_SOURCES,
    canPost: Boolean(isAdmin),
    // Show the history of what was just posted.
    onSaved: (savedKindKey, status) => {
      setShowForm(false);
      if (status === "posted") showHistoryOf(savedKindKey);
    },
  });
  const openDraft = (draft) => {
    purchaseForm.loadDraft(draft);
    setShowForm(true);
  };
  const closeDraftReceipts = useCallback(() => setDraftReceipts(null), []);
  const draftForReceipts =
    draftReceipts && drafts.find((draft) => draft.kind === draftReceipts.kind && draft.id === draftReceipts.id);
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
    setReceiptPurchaseId(null);
  }, [setEditingItem, setSelectedGroup]);
  const closeReceipts = useCallback(() => setReceiptPurchaseId(null), []);
  // Read from the refetched group so added or deleted photos show at once.
  const receiptAttachments =
    selectedGroup?.histories.find((item) => item.purchaseId === receiptPurchaseId)?.attachments || [];

  return (
    <section className="mb-5 rounded-lg bg-[#1f1f1f] p-4 text-[#f5f5f5]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">Nota Belanja</h3>
          <p className="mt-1 text-sm text-[#ababab]">
            Belanja bahan baku dan perlengkapan, riwayatnya dikelompokkan per barang.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <button
            className={`${buttonClass} whitespace-nowrap`}
            onClick={() => setShowForm(true)}
            type="button"
          >
            Tambah Belanja
          </button>
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

      <PurchaseDraftsPanel
        drafts={drafts}
        canPost={Boolean(isAdmin)}
        onOpen={openDraft}
        onOpenReceipts={(draft) => setDraftReceipts({ kind: draft.kind, id: draft.id })}
        onDeleted={(draft) => {
          const editing = purchaseForm.editingDraft;
          if (editing && editing.kind === draft.kind && editing.id === draft.id) purchaseForm.reset();
        }}
      />

      <div
        role="group"
        aria-label="Riwayat jenis belanja"
        className="mb-4 flex w-fit gap-1 rounded-lg bg-[#181818] p-1 text-sm font-semibold"
      >
        {PURCHASE_KIND_LIST.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={historyKindKey === option.key}
            onClick={() => showHistoryOf(option.key)}
            className={`rounded-md px-4 py-2 transition-colors ${
              historyKindKey === option.key
                ? "bg-[#a79981] text-[#101010]"
                : "text-[#ababab] hover:bg-[#333] hover:text-white"
            }`}
          >
            {option.label}
          </button>
        ))}
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
        <p className="py-5 text-center text-[#ababab]">
          Belum ada belanja {historyKind.label.toLowerCase()} tersimpan.
        </p>
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
          onOpenReceipts={setReceiptPurchaseId}
        />
      )}

      {selectedGroup && receiptPurchaseId && (
        <PurchaseReceiptsDialog
          purchaseId={receiptPurchaseId}
          attachments={receiptAttachments}
          isAdmin={isAdmin}
          onClose={closeReceipts}
          kind={historyKind}
        />
      )}

      {draftForReceipts && (
        <PurchaseReceiptsDialog
          purchaseId={draftForReceipts.id}
          attachments={draftForReceipts.attachments}
          isAdmin
          onClose={closeDraftReceipts}
          kind={PURCHASE_KINDS[draftForReceipts.kind]}
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
