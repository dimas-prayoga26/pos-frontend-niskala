import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { getPaymentSources, getShoppingSuppliers } from "../api";
import usePurchaseForm from "../hooks/usePurchaseForm";
import usePurchaseHistory from "../hooks/usePurchaseHistory";
import usePurchaseItemActions from "../hooks/usePurchaseItemActions";
import usePurchaseItemDetail from "../hooks/usePurchaseItemDetail";
import { DEFAULT_PERIOD, PERIOD_OPTIONS, periodRange, rangeLabel, rangeParams } from "../utils/periods";
import { exportRekapToExcel, fetchAllNotas, openPrintWindow, printRekap } from "../utils/purchaseExport";
import { HISTORY_TABS, PURCHASE_KINDS, historyTabOf, historyViewsOf } from "../utils/purchaseKinds";
import PurchaseDraftsPanel from "./shopping/PurchaseDraftsPanel";
import PurchaseFormDialog from "./shopping/PurchaseFormDialog";
import PurchaseHistoryDialog from "./shopping/PurchaseHistoryDialog";
import PurchaseHistoryTable from "./shopping/PurchaseHistoryTable";
import PurchaseItemEditDialog from "./shopping/PurchaseItemEditDialog";
import PurchaseNotaTable from "./shopping/PurchaseNotaTable";
import PurchasePeriodBar from "./shopping/PurchasePeriodBar";
import PurchaseReceiptsDialog from "./shopping/PurchaseReceiptsDialog";
import { buttonClass, inputClass } from "./shopping/styles";

const NO_SOURCES = [];
const NO_ITEMS = [];
const toggleClass = (active) =>
  `rounded-md px-4 py-2 transition-colors ${
    active ? "bg-[#a79981] text-[#101010]" : "text-[#ababab] hover:bg-[#333] hover:text-white"
  }`;

// The one place for belanja (the "Belanja" menu): the "Tambah Belanja" form for both Jenis
// Belanja (bahan baku, lainnya), the draft nota waiting to be posted, and
// the searchable history, in tabs Bahan Baku and the kategori of barang
// Lainnya (Peralatan, Perlengkapan, Promosi, Lain-lain), shown Per Struk (each
// nota with its barang and the TOTAL PENGELUARAN) or Per Bahan / Per Barang
// (one row per item with its latest purchase and COGS, or Harga Rata-rata for
// Lainnya). Clicking a barang in either opens its detail: stok, COGS, riwayat
// and log, where admins change or delete a line. A period filter (default
// Bulan Ini) narrows the history and its TOTAL PENGELUARAN, except Peralatan
// (assets, lifetime), and exports it to Excel or PDF. Every staff member may
// save a draft; only admins post. See SHOPPING.md in pos-backend.
export default function ShoppingManagement({ stockItems, supplyItems = NO_ITEMS, isAdmin }) {
  const [showForm, setShowForm] = useState(false);
  const [historyTab, setHistoryTab] = useState(HISTORY_TABS[0]);
  const [historyView, setHistoryView] = useState("nota");
  const historyKind = PURCHASE_KINDS[historyTab.kindKey];
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [customRange, setCustomRange] = useState({ from: "", to: "" });
  const [isExporting, setIsExporting] = useState(false);
  // Peralatan are assets: their tab always shows the whole lifetime.
  const isLifetime = historyTab.kindKey === "supply" && historyTab.category === "Peralatan";
  const range = isLifetime ? {} : periodRange(period, customRange);
  const periodText = isLifetime
    ? "Seumur hidup (aset)"
    : `${PERIOD_OPTIONS.find((option) => option.key === period)?.label}${period === "all" ? "" : ` (${rangeLabel(range)})`}`;
  const [receiptPurchaseId, setReceiptPurchaseId] = useState(null);
  // The barang of a Per Nota line whose detail is open: { itemId, itemName }.
  const [notaLine, setNotaLine] = useState(null);
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
  const historyState = usePurchaseHistory(historyKind, { category: historyTab.category, view: historyView, range });
  const {
    history,
    notas,
    notaCount,
    totalSpending,
    itemGroups,
    page,
    setPage,
    totalPages,
    selectedGroup,
    setSelectedGroup,
  } = historyState;
  const isNotaView = historyView === "nota";
  const itemDetail = usePurchaseItemDetail(historyKind, notaLine);
  // The barang whose detail is open: a line of a struk, or a Per Bahan row.
  const openGroup = notaLine ? itemDetail.group : selectedGroup;
  const itemActions = usePurchaseItemActions(historyKind);
  const showHistoryOf = (tab, view = historyView) => {
    setHistoryTab(tab);
    setHistoryView(view);
    setNotaLine(null);
    setSelectedGroup(null);
    setPage(1);
  };
  const changePeriod = (next) => {
    setPeriod(next);
    setPage(1);
  };
  const changeCustomRange = (next) => {
    setCustomRange(next);
    setPage(1);
  };
  // The nota of the tab, period and search (all pages) to Excel or PDF.
  const exportRekap = async (format) => {
    if (isExporting) return;
    const printWindow = format === "pdf" ? openPrintWindow() : null;
    if (format === "pdf" && !printWindow) {
      enqueueSnackbar("Browser memblokir jendela cetak. Izinkan pop-up untuk Export PDF.", { variant: "warning" });
      return;
    }
    setIsExporting(true);
    try {
      const { notas: allNotas, totalSpending: spent } = await fetchAllNotas(historyKind, {
        search: historyState.search,
        ...(historyTab.category && { category: historyTab.category }),
        ...rangeParams(range),
      });
      if (!allNotas.length) {
        printWindow?.close();
        enqueueSnackbar("Tidak ada nota untuk diexport pada periode ini.", { variant: "info" });
        return;
      }
      const rekap = { notas: allNotas, totalSpending: spent, tabLabel: historyTab.label, range, periodText, showUnits: historyKind.showUnits };
      if (printWindow) printRekap(printWindow, rekap);
      else exportRekapToExcel(rekap);
    } catch (error) {
      printWindow?.close();
      enqueueSnackbar(error?.response?.data?.message || "Export gagal. Coba lagi.", { variant: "error" });
    } finally {
      setIsExporting(false);
    }
  };
  const purchaseForm = usePurchaseForm({
    suppliers: suppliers.data?.data?.data || [],
    stockItems,
    supplyItems,
    paymentSources: paymentSources.data?.data?.data || NO_SOURCES,
    canPost: Boolean(isAdmin),
    // Show the history of what was just posted.
    onSaved: (savedKindKey, status, category) => {
      setShowForm(false);
      if (status === "posted") showHistoryOf(historyTabOf(savedKindKey, category));
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
    if (!showForm && !openGroup && !editingItem) return undefined;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [showForm, openGroup, editingItem]);

  // The barang opened from a nota lost its last line, or could not be loaded.
  useEffect(() => {
    if (itemDetail.isError) enqueueSnackbar("Detail barang gagal dimuat.", { variant: "error" });
    if (itemDetail.isGone || itemDetail.isError) setNotaLine(null);
  }, [itemDetail.isError, itemDetail.isGone]);

  const closeHistoryDetail = useCallback(() => {
    setNotaLine(null);
    setSelectedGroup(null);
    setEditingItem(null);
    setReceiptPurchaseId(null);
  }, [setEditingItem, setSelectedGroup]);
  const closeReceipts = useCallback(() => setReceiptPurchaseId(null), []);
  // Read from the refetched group or nota so added or deleted photos show at once.
  const receiptAttachments = openGroup
    ? openGroup.histories.find((item) => item.purchaseId === receiptPurchaseId)?.attachments || []
    : notas.find((nota) => nota.id === receiptPurchaseId)?.attachments || [];

  return (
    <section className="mb-5 rounded-lg bg-[#1f1f1f] p-4 text-[#f5f5f5]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">Nota Belanja</h3>
          <p className="mt-1 text-sm text-[#ababab]">
            Belanja bahan baku dan lainnya, riwayatnya per struk atau per bahan. Klik barang untuk melihat detailnya.
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

      <PurchasePeriodBar
        period={period}
        onPeriodChange={changePeriod}
        customRange={customRange}
        onCustomRangeChange={changeCustomRange}
        rangeText={periodText}
        isLifetime={isLifetime}
        onExport={exportRekap}
        isExporting={isExporting}
      />

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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label="Riwayat jenis belanja"
          className="flex w-fit max-w-full flex-wrap gap-1 rounded-lg bg-[#181818] p-1 text-sm font-semibold"
        >
          {HISTORY_TABS.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={historyTab.key === option.key}
              onClick={() => showHistoryOf(option)}
              className={toggleClass(historyTab.key === option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div
          role="group"
          aria-label="Tampilan riwayat"
          className="flex w-fit gap-1 rounded-lg bg-[#181818] p-1 text-sm font-semibold"
        >
          {historyViewsOf(historyKind).map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={historyView === option.key}
              onClick={() => showHistoryOf(historyTab, option.key)}
              className={toggleClass(historyView === option.key)}
            >
              {option.label}
            </button>
          ))}
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
      {!history.isPending && !history.isError && !(isNotaView ? notas.length : itemGroups.length) && (
        <p className="py-5 text-center text-[#ababab]">
          Belum ada belanja {historyTab.label.toLowerCase()} tersimpan.
        </p>
      )}

      {!history.isPending && !history.isError && isNotaView && notas.length > 0 && (
        <PurchaseNotaTable
          notas={notas}
          notaCount={notaCount}
          totalSpending={totalSpending}
          periodText={periodText}
          isAdmin={isAdmin}
          onOpenItem={(item) => setNotaLine({ itemId: item[historyKind.itemIdKey] || null, itemName: item.itemName })}
          onOpenReceipts={setReceiptPurchaseId}
          showUnits={historyKind.showUnits}
        />
      )}
      {!history.isPending && !history.isError && !isNotaView && itemGroups.length > 0 && (
        <PurchaseHistoryTable
          itemGroups={itemGroups}
          onOpen={setSelectedGroup}
          showUnits={historyKind.showUnits}
          costLabel={historyKind.costLabel}
        />
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

      {openGroup && (
        <PurchaseHistoryDialog
          group={openGroup}
          isAdmin={isAdmin}
          onClose={closeHistoryDetail}
          onEditItem={itemActions.startEdit}
          onDeleteItem={itemActions.removeItem}
          isDeleting={itemActions.isDeleting}
          onOpenReceipts={setReceiptPurchaseId}
          showUnits={historyKind.showUnits}
          costLabel={historyKind.costLabel}
        />
      )}

      {receiptPurchaseId && (
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
          itemName={editingItem.itemName || openGroup?.itemName}
          form={itemActions.editForm}
          onChange={(patch) => itemActions.setEditForm((current) => ({ ...current, ...patch }))}
          onSubmit={itemActions.submitEdit}
          onClose={() => setEditingItem(null)}
          isSaving={itemActions.isSaving}
          showUnits={historyKind.showUnits}
        />
      )}

      {showForm && (
        <PurchaseFormDialog purchaseForm={purchaseForm} onClose={() => setShowForm(false)} />
      )}
    </section>
  );
}
