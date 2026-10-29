import { formatReceiptCurrency } from "../../../shared/lib/format";

// Saldo can be negative: "-Rp 7.000" rather than "Rp -7.000".
export const formatSaldo = (value) =>
  Number(value || 0) < 0 ? `-${formatReceiptCurrency(-Number(value))}` : formatReceiptCurrency(value);

const REFERENCE_LABELS = {
  manual: "Catat manual",
  purchase: "Belanja",
  purchase_edit: "Ubah item belanja",
  purchase_delete: "Hapus item belanja",
  supply_purchase: "Belanja lainnya",
  supply_purchase_edit: "Ubah item belanja lainnya",
  supply_purchase_delete: "Hapus item belanja lainnya",
};

export const getMutationLabel = (mutation) =>
  REFERENCE_LABELS[mutation.referenceType] || mutation.referenceType;
