import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { getJakartaDateKey } from "../../../shared/lib/dates";
import { signedCurrency } from "../utils/format";
import { DEFAULT_TAX_PERCENT, computeNotaTotals, parsePercent } from "../utils/notaTotals";
import { PURCHASE_KINDS } from "../utils/purchaseKinds";
import {
  MAX_RECEIPTS_PER_UPLOAD,
  compressReceiptImage,
  createReceipt,
  isImageFile,
  revokeReceipt,
} from "../utils/receiptImages";
import {
  blankRow,
  buildPurchasePayload,
  createRequestId,
  isPurchaseFormComplete,
  lineTotal,
} from "../utils/shopping";

const NO_ITEMS = [];

// paymentSourceId "" means the first active source (Kasir (Tunai)). kind is
// the Jenis Belanja (PURCHASE_KINDS): bahan baku or perlengkapan. The footer
// (Ringkasan) holds ongkir, Diskon Nota (Rp or %) and PPN.
const initialForm = () => ({
  kind: "raw",
  date: getJakartaDateKey(),
  suplierId: "",
  paymentSourceId: "",
  note: "",
  shippingCost: "",
  discountType: "amount",
  discountValue: "",
  taxEnabled: false,
  taxPercent: String(DEFAULT_TAX_PERCENT),
});

// Merges saved options with names created in the form ("draft:" ids).
const toOptions = (items, extras, toOption) =>
  Array.from(new Map([...items, ...extras].map((item) => [item.id, toOption(item)])).values());

const draftItemId = (name) => `draft:${name.toLowerCase()}`;

const findOrDraft = (options, extras, setExtras, name, unit) => {
  const existing = options.find((item) => item.text.toLowerCase() === name.toLowerCase());

  if (existing) return existing;

  const created = { id: draftItemId(name), name, ...(unit !== undefined && { unit }) };
  setExtras((current) => [...current.filter((item) => item.id !== created.id), created]);
  return { id: created.id, text: created.name, ...(unit !== undefined && { unit }) };
};

// Footer values as the API takes them; PPN only when the supplier charges it.
const footerOf = (form) => ({
  shippingCost: Number(form.shippingCost || 0),
  discountType: form.discountType,
  discountValue: form.discountType === "percent" ? parsePercent(form.discountValue) : Number(form.discountValue || 0),
  taxPercent: form.taxEnabled ? parsePercent(form.taxPercent) : 0,
});

// State of the "Tambah Belanja" form, for both Jenis Belanja. It lives
// in the parent so a closed form keeps its draft until it is saved or the page
// reloads. A saved draft nota (Simpan Draft) can be opened again with
// loadDraft; only admins post (Simpan & Posting).
const usePurchaseForm = ({
  suppliers,
  stockItems,
  supplyItems = NO_ITEMS,
  paymentSources = [],
  canPost = true,
  onSaved,
}) => {
  const queryClient = useQueryClient();
  const [rawForm, setForm] = useState(initialForm);
  const [rows, setRows] = useState(() => [blankRow()]);
  const [extraItems, setExtraItems] = useState([]);
  const [extraSuppliers, setExtraSuppliers] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [preparingReceipts, setPreparingReceipts] = useState(false);
  // The draft nota being changed: { id, kind, attachments }.
  const [editingDraft, setEditingDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  // Same payload => same requestId, so a retried save cannot add stock twice.
  const submission = useRef(null);
  const receiptsRef = useRef(receipts);
  receiptsRef.current = receipts;

  // Free the photo previews when the page unmounts.
  useEffect(() => () => receiptsRef.current.forEach(revokeReceipt), []);

  const form = useMemo(
    () => ({
      ...rawForm,
      paymentSourceId: rawForm.paymentSourceId || paymentSources[0]?.id || "",
    }),
    [rawForm, paymentSources]
  );
  const kind = PURCHASE_KINDS[form.kind] || PURCHASE_KINDS.raw;
  const selectedSource = paymentSources.find(
    (source) => String(source.id) === String(form.paymentSourceId)
  );
  // "Rekening Penjualan (Rp 85.000)": each source with its current saldo
  // (kasir get no saldo, so only the name).
  const paymentSourceOptions = useMemo(
    () =>
      paymentSources.map((source) => ({
        id: source.id,
        text: source.balance == null ? source.name : `${source.name} (${signedCurrency(source.balance)})`,
      })),
    [paymentSources]
  );
  const totals = computeNotaTotals(rows.map(lineTotal), footerOf(form));

  const supplierOptions = useMemo(
    () => toOptions(suppliers, extraSuppliers, (item) => ({ id: item.id, text: item.name })),
    [suppliers, extraSuppliers]
  );
  const itemOptions = useMemo(
    () =>
      toOptions(kind.key === "supply" ? supplyItems : stockItems, extraItems, (item) => ({
        id: item.id,
        text: item.name,
        unit: item.unit,
        ...(item.category && { category: item.category }),
      })),
    [kind.key, stockItems, supplyItems, extraItems]
  );

  // Items differ per Jenis Belanja, so switching starts the item lines over;
  // the nota (tanggal, toko, pembayaran, catatan, bukti) stays.
  const changeKind = (nextKind) => {
    if (nextKind === form.kind || editingDraft) return;
    setForm((current) => ({ ...current, kind: nextKind }));
    setRows([blankRow()]);
    setExtraItems([]);
  };

  const updateRow = (key, patch) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const addRow = () => setRows((current) => [...current, blankRow()]);
  const removeRow = (key) => setRows((current) => current.filter((item) => item.key !== key));

  const addReceipts = async (files) => {
    const images = files.filter(isImageFile);
    const room = MAX_RECEIPTS_PER_UPLOAD - receiptsRef.current.length;

    if (images.length < files.length) {
      enqueueSnackbar("Hanya file foto yang bisa dipakai sebagai bukti nota.", { variant: "warning" });
    }
    if (images.length > room) {
      enqueueSnackbar(`Maksimal ${MAX_RECEIPTS_PER_UPLOAD} foto bukti per belanja.`, { variant: "warning" });
    }
    if (!images.length || room <= 0) return;

    setPreparingReceipts(true);
    try {
      const prepared = await Promise.all(images.slice(0, room).map(compressReceiptImage));
      setReceipts((current) => [...current, ...prepared.map(createReceipt)].slice(0, MAX_RECEIPTS_PER_UPLOAD));
    } finally {
      setPreparingReceipts(false);
    }
  };
  const removeReceipt = (key) => {
    receiptsRef.current.filter((receipt) => receipt.key === key).forEach(revokeReceipt);
    setReceipts((current) => current.filter((receipt) => receipt.key !== key));
  };

  const reset = () => {
    setRows([blankRow()]);
    setForm(initialForm());
    setExtraItems([]);
    setExtraSuppliers([]);
    receiptsRef.current.forEach(revokeReceipt);
    setReceipts([]);
    setEditingDraft(null);
    submission.current = null;
  };

  // Opens a saved draft nota in the form; new item names come back as "draft:" options.
  const loadDraft = (draft) => {
    const draftKind = PURCHASE_KINDS[draft.kind] || PURCHASE_KINDS.raw;
    const newNames = draft.items.filter((item) => !item[draftKind.itemIdKey]);
    receiptsRef.current.forEach(revokeReceipt);
    setReceipts([]);
    setExtraSuppliers([]);
    setExtraItems(newNames.map((item) => ({ id: draftItemId(item.itemName), name: item.itemName, unit: "" })));
    setForm({
      ...initialForm(),
      kind: draftKind.key,
      date: String(draft.date).slice(0, 10),
      suplierId: draft.suplierId,
      paymentSourceId: draft.paymentSourceId || "",
      note: draft.note || "",
      shippingCost: draft.shippingCost ? String(draft.shippingCost) : "",
      discountType: draft.discountType === "percent" ? "percent" : "amount",
      discountValue: draft.discountValue ? String(draft.discountValue) : "",
      taxEnabled: Number(draft.taxPercent) > 0,
      taxPercent: Number(draft.taxPercent) > 0 ? String(draft.taxPercent) : String(DEFAULT_TAX_PERCENT),
    });
    setRows(
      draft.items.map((item) => ({
        ...blankRow(),
        stockItemId: item[draftKind.itemIdKey] || draftItemId(item.itemName),
        category: item.category || "",
        quantity: String(item.quantity),
        unit: item.unit,
        unitPrice: String(Math.round(Number(item.total || 0))),
      }))
    );
    setEditingDraft({ id: draft.id, kind: draftKind.key, attachments: draft.attachments || [] });
    submission.current = null;
  };

  const createSupplier = (name) =>
    findOrDraft(supplierOptions, extraSuppliers, setExtraSuppliers, name);
  const createItem = (name) => findOrDraft(itemOptions, extraItems, setExtraItems, name, "");

  const save = async (status) => {
    if (lock.current || preparingReceipts) return;
    if (status === "posted" && !canPost) {
      enqueueSnackbar("Hanya admin yang bisa memposting belanja. Simpan sebagai draft.", { variant: "error" });
      return;
    }

    if (!form.paymentSourceId) {
      enqueueSnackbar("Pilih sumber pembayaran. Tambahkan di Pengaturan jika belum ada.", {
        variant: "error",
      });
      return;
    }

    if (!isPurchaseFormComplete(form, rows, { requireUnit: kind.showUnits })) {
      enqueueSnackbar(
        kind.showUnits
          ? "Lengkapi toko, barang, gramasi, satuan, dan harga total."
          : "Lengkapi toko, barang, qty, dan harga total.",
        { variant: "error" }
      );
      return;
    }

    if (
      kind.key === "supply" &&
      rows.some((row) => String(row.stockItemId).startsWith("draft:") && !row.category)
    ) {
      enqueueSnackbar("Pilih kategori untuk barang baru.", { variant: "error" });
      return;
    }

    const footer = footerOf(form);
    if (
      !Number.isFinite(footer.discountValue) ||
      !Number.isFinite(footer.taxPercent) ||
      footer.taxPercent > 100 ||
      (footer.discountType === "percent" && footer.discountValue > 100)
    ) {
      enqueueSnackbar("Diskon % dan PPN harus antara 0 dan 100.", { variant: "error" });
      return;
    }

    const payload = {
      ...buildPurchasePayload(form, rows, {
        extraSuppliers,
        extraItems,
        itemIdKey: kind.itemIdKey,
      }),
      ...footer,
      status,
    };
    delete payload.taxEnabled;
    const signature = JSON.stringify(payload);

    if (!submission.current || submission.current.signature !== signature) {
      submission.current = { signature, id: createRequestId() };
    }

    lock.current = true;
    setSaving(true);
    try {
      const response = editingDraft
        ? await kind.updateDraft({ id: editingDraft.id, ...payload })
        : await kind.save({ ...payload, requestId: submission.current.id });
      const purchaseId = response?.data?.data?.id;
      let receiptsFailed = false;

      if (receipts.length && purchaseId) {
        try {
          await kind.uploadAttachments({ purchaseId, files: receipts.map((receipt) => receipt.file) });
        } catch {
          receiptsFailed = true;
        }
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [kind.stockKey] }),
        queryClient.invalidateQueries({ queryKey: [kind.historyKey] }),
        queryClient.invalidateQueries({ queryKey: ["purchase-drafts"] }),
        queryClient.invalidateQueries({ queryKey: ["shopping-suppliers"] }),
        queryClient.invalidateQueries({ queryKey: ["payment-sources"] }),
        queryClient.invalidateQueries({ queryKey: ["payment-source-mutations"] }),
      ]);
      enqueueSnackbar(
        status === "draft"
          ? "Draft nota tersimpan. Stok dan saldo berubah setelah diposting admin."
          : kind.key === "supply"
            ? "Belanja lainnya tersimpan dan stoknya bertambah."
            : "Belanja tersimpan dan stok berhasil ditambahkan.",
        { variant: "success" }
      );
      if (receiptsFailed) {
        enqueueSnackbar(
          `Foto bukti nota gagal diunggah. Tambahkan lagi dari riwayat belanja #${purchaseId}.`,
          { variant: "warning" }
        );
      }
      // Barang Lainnya: the kategori of the first line, so the history opens on its tab.
      const firstItem = itemOptions.find((option) => String(option.id) === String(rows[0]?.stockItemId));
      onSaved(kind.key, status, kind.key === "supply" ? rows[0]?.category || firstItem?.category || "" : "");
      reset();
    } catch (error) {
      enqueueSnackbar(
        error?.response?.data?.message ||
          "Belum mendapat konfirmasi penyimpanan. Coba simpan lagi dengan data yang sama.",
        { variant: "error" }
      );
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  // The form's submit button is "Simpan & Posting".
  const submit = async (event) => {
    event.preventDefault();
    await save("posted");
  };

  return {
    form,
    setForm,
    kind,
    changeKind,
    rows,
    updateRow,
    addRow,
    removeRow,
    saving,
    supplierOptions,
    itemOptions,
    paymentSourceOptions,
    selectedSource,
    totals,
    canPost,
    editingDraft,
    loadDraft,
    reset,
    receipts,
    preparingReceipts,
    addReceipts,
    removeReceipt,
    createSupplier,
    createItem,
    submit,
    saveDraft: () => save("draft"),
  };
};

export default usePurchaseForm;
