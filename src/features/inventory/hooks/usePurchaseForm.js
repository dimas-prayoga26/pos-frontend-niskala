import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { getJakartaDateKey } from "../../../shared/lib/dates";
import { savePurchase } from "../api";
import {
  blankRow,
  buildPurchasePayload,
  createRequestId,
  isPurchaseFormComplete,
} from "../utils/shopping";

const initialForm = () => ({
  date: getJakartaDateKey(),
  suplierId: "",
  paymentMethod: "Cash",
  note: "",
});

// Merges saved options with names created in the form ("draft:" ids).
const toOptions = (items, extras, toOption) =>
  Array.from(new Map([...items, ...extras].map((item) => [item.id, toOption(item)])).values());

const findOrDraft = (options, extras, setExtras, name, unit) => {
  const existing = options.find((item) => item.text.toLowerCase() === name.toLowerCase());

  if (existing) return existing;

  const created = { id: `draft:${name.toLowerCase()}`, name, ...(unit !== undefined && { unit }) };
  setExtras((current) => [...current.filter((item) => item.id !== created.id), created]);
  return { id: created.id, text: created.name, ...(unit !== undefined && { unit }) };
};

// State of the "Tambah Bahan Belanjaan" form. It lives in the parent so a
// closed form keeps its draft until it is saved or the page reloads.
const usePurchaseForm = ({ suppliers, stockItems, onSaved }) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initialForm);
  const [rows, setRows] = useState(() => [blankRow()]);
  const [extraItems, setExtraItems] = useState([]);
  const [extraSuppliers, setExtraSuppliers] = useState([]);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  // Same payload => same requestId, so a retried save cannot add stock twice.
  const submission = useRef(null);

  const supplierOptions = useMemo(
    () => toOptions(suppliers, extraSuppliers, (item) => ({ id: item.id, text: item.name })),
    [suppliers, extraSuppliers]
  );
  const itemOptions = useMemo(
    () =>
      toOptions(stockItems, extraItems, (item) => ({ id: item.id, text: item.name, unit: item.unit })),
    [stockItems, extraItems]
  );

  const updateRow = (key, patch) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const addRow = () => setRows((current) => [...current, blankRow()]);
  const removeRow = (key) => setRows((current) => current.filter((item) => item.key !== key));

  const reset = () => {
    setRows([blankRow()]);
    setForm(initialForm());
    setExtraItems([]);
    setExtraSuppliers([]);
    submission.current = null;
  };

  const createSupplier = (name) =>
    findOrDraft(supplierOptions, extraSuppliers, setExtraSuppliers, name);
  const createItem = (name) => findOrDraft(itemOptions, extraItems, setExtraItems, name, "");

  const submit = async (event) => {
    event.preventDefault();
    if (lock.current) return;

    if (!isPurchaseFormComplete(form, rows)) {
      enqueueSnackbar("Lengkapi toko, barang, gramasi, satuan, dan harga total.", {
        variant: "error",
      });
      return;
    }

    const payload = buildPurchasePayload(form, rows, { extraSuppliers, extraItems });
    const signature = JSON.stringify(payload);

    if (!submission.current || submission.current.signature !== signature) {
      submission.current = { signature, id: createRequestId() };
    }

    lock.current = true;
    setSaving(true);
    try {
      await savePurchase({ ...payload, requestId: submission.current.id });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["stock-items"] }),
        queryClient.invalidateQueries({ queryKey: ["purchases"] }),
        queryClient.invalidateQueries({ queryKey: ["shopping-suppliers"] }),
      ]);
      enqueueSnackbar("Belanja tersimpan dan stok berhasil ditambahkan.", {
        variant: "success",
      });
      onSaved();
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

  return {
    form,
    setForm,
    rows,
    updateRow,
    addRow,
    removeRow,
    saving,
    supplierOptions,
    itemOptions,
    createSupplier,
    createItem,
    submit,
  };
};

export default usePurchaseForm;
