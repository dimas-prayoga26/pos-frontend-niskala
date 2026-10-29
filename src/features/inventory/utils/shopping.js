import { currency, quantityDisplay } from "./format";

// Purchase (belanja) helpers. The form asks for the TOTAL price of a line; the
// API expects a unit price, so it is derived as total / quantity.
export const UNIT_OPTIONS = ["gr", "pcs", "ml"].map((unit) => ({ id: unit, text: unit }));
export const HISTORY_PAGE_SIZE = 10;

let rowKey = 0;

// stockItemId holds the chosen item of either Jenis Belanja; category is only
// asked for a new perlengkapan.
export const blankRow = () => ({
  key: ++rowKey,
  stockItemId: "",
  category: "",
  quantity: "",
  unit: "",
  unitPrice: "",
});

// Random id sent with a purchase; the server ignores replays of the same id.
export const createRequestId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
    n.toString(16).padStart(2, "0")
  ).join("");

// Accepts "1.5", "1,5" and fractions such as "1/2". Returns NaN when invalid.
export const parseShoppingQuantity = (value) => {
  const input = String(value ?? "").trim().replace(",", ".");

  if (!input) return NaN;

  const fraction = input.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);

  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);

    return denominator > 0 ? numerator / denominator : NaN;
  }

  return Number(input);
};

// Default purchase unit for a stock item's unit.
export const purchaseUnitForStockUnit = (unit) => {
  const normalizedUnit = String(unit || "").trim().toLowerCase();

  if (["gr", "g", "gram"].includes(normalizedUnit)) return "gr";
  if (["ml", "milliliter", "mililiter"].includes(normalizedUnit)) return "ml";

  return unit || "";
};

// A row's "unitPrice" field holds the line total typed by the user.
export const lineTotal = (row) => Math.round(Number(row.unitPrice || 0) * 100) / 100;

export const unitPriceFromTotal = (quantity, total) =>
  Math.round((Number(total || 0) / Math.max(Number(quantity || 0), 1)) * 100) / 100;

// requireUnit is false for barang Lainnya, which have no unit.
export const isPurchaseFormComplete = (form, rows, { requireUnit = true } = {}) =>
  Boolean(form.suplierId) &&
  !rows.some(
    (row) =>
      !row.stockItemId ||
      (requireUnit && !row.unit.trim()) ||
      !Number.isFinite(parseShoppingQuantity(row.quantity)) ||
      parseShoppingQuantity(row.quantity) <= 0 ||
      row.unitPrice === ""
  );

// Names created in the form ("draft:" ids) are sent as names so the server
// creates the supplier/item inside the purchase transaction.
// itemIdKey is the API's name for an existing item: stockItemId (bahan baku)
// or supplyItemId (perlengkapan).
export const buildPurchasePayload = (
  form,
  rows,
  { extraSuppliers, extraItems, itemIdKey = "stockItemId" }
) => {
  const supplierDraft = extraSuppliers.find((item) => item.id === form.suplierId);
  const { suplierId, ...details } = form;
  // Jenis Belanja picks the endpoint; it is not part of the nota.
  delete details.kind;

  return {
    ...details,
    ...(supplierDraft ? { suplierName: supplierDraft.name } : { suplierId }),
    items: rows.map(({ stockItemId, category, quantity, unit, unitPrice }) => {
      const draft = extraItems.find((item) => item.id === stockItemId);
      const parsedQuantity = parseShoppingQuantity(quantity);

      return {
        ...(draft
          ? { itemName: draft.name, ...(category && { category }) }
          : { [itemIdKey]: stockItemId }),
        quantity: parsedQuantity,
        // Lines without unit (barang Lainnya) take their item's unit on the server.
        ...(unit && { unit }),
        unitPrice: unitPriceFromTotal(parsedQuantity, unitPrice),
      };
    }),
  };
};

export const getLogActionLabel = (log) =>
  log.action === "create" ? "Tambah" : log.action === "delete" ? "Hapus" : "Edit";

export const getLogDetail = (log) =>
  log.action === "create"
    ? `${quantityDisplay(log.newData?.quantity, log.newData?.unit)} ditambahkan, harga ${currency(log.newData?.unitPrice)}`
    : log.action === "delete"
      ? `${quantityDisplay(log.oldData?.quantity, log.oldData?.unit)} dihapus`
      : `${quantityDisplay(log.oldData?.quantity, log.oldData?.unit)} -> ${quantityDisplay(log.newData?.quantity, log.newData?.unit)}, ${currency(log.oldData?.unitPrice)} -> ${currency(log.newData?.unitPrice)}`;

const percentLabel = (value) => Number(value).toLocaleString("id-ID", { maximumFractionDigits: 2 });

// Ongkir, diskon and PPN of a posted nota as lines under its barang, like the
// paper nota ("Ongkir 1 × Rp 336 = Rp 336"); the Total under them is its
// Grand Total. Used by the Per Nota table and the nota detail.
export const notaFooterLines = (nota) => [
  ...(nota.shippingCost > 0
    ? [{ key: "shipping", label: "Ongkir", quantity: 1, price: nota.shippingCost, amount: nota.shippingCost }]
    : []),
  ...(nota.discountAmount > 0
    ? [
        {
          key: "discount",
          label: nota.discountType === "percent" ? `Diskon Nota (${percentLabel(nota.discountValue)}%)` : "Diskon Nota",
          amount: -nota.discountAmount,
        },
      ]
    : []),
  ...(nota.taxAmount > 0 ? [{ key: "tax", label: `PPN ${percentLabel(nota.taxPercent)}%`, amount: nota.taxAmount }] : []),
];
