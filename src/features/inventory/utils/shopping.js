import { currency, quantityDisplay } from "./format";

// Purchase (belanja) helpers. The form asks for the TOTAL price of a line; the
// API expects a unit price, so it is derived as total / quantity.
export const PAYMENT_OPTIONS = ["Cash", "Rekening Penjualan", "Transfer", "QRIS"].map((name) => ({
  id: name,
  text: name,
}));
export const UNIT_OPTIONS = ["gr", "pcs", "ml"].map((unit) => ({ id: unit, text: unit }));
export const HISTORY_PAGE_SIZE = 10;

let rowKey = 0;

export const blankRow = () => ({
  key: ++rowKey,
  stockItemId: "",
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

export const isPurchaseFormComplete = (form, rows) =>
  Boolean(form.suplierId) &&
  !rows.some(
    (row) =>
      !row.stockItemId ||
      !row.unit.trim() ||
      !Number.isFinite(parseShoppingQuantity(row.quantity)) ||
      parseShoppingQuantity(row.quantity) <= 0 ||
      row.unitPrice === ""
  );

// Names created in the form ("draft:" ids) are sent as names so the server
// creates the supplier/item inside the purchase transaction.
export const buildPurchasePayload = (form, rows, { extraSuppliers, extraItems }) => {
  const supplierDraft = extraSuppliers.find((item) => item.id === form.suplierId);
  const { suplierId, ...details } = form;

  return {
    ...details,
    ...(supplierDraft ? { suplierName: supplierDraft.name } : { suplierId }),
    items: rows.map(({ stockItemId, quantity, unit, unitPrice }) => {
      const draft = extraItems.find((item) => item.id === stockItemId);
      const parsedQuantity = parseShoppingQuantity(quantity);

      return {
        ...(draft ? { itemName: draft.name } : { stockItemId }),
        quantity: parsedQuantity,
        unit,
        unitPrice: unitPriceFromTotal(parsedQuantity, unitPrice),
      };
    }),
  };
};

// Groups purchase lines per stock item when the API does not return itemGroups.
export const buildFallbackItemGroups = (purchases = [], stockItems = []) => {
  const stockById = new Map(stockItems.map((item) => [Number(item.id || item._id), item]));
  const groups = new Map();

  purchases.forEach((purchase) => {
    (purchase.items || []).forEach((item) => {
      const stockItemId = Number(item.stock_item_id);
      const key = stockItemId || item.item_name;
      const stockItem = stockById.get(stockItemId);

      if (!groups.has(key)) {
        groups.set(key, {
          stockItemId: stockItemId || null,
          itemName: item.item_name,
          stock: stockItem ? Number(stockItem.stock || 0) : null,
          stockUnit: stockItem?.unit || item.stock_unit,
          averageCost: Number(stockItem?.averageCost || item.stock_unit_cost || 0),
          stockValue: Number(stockItem?.stockValue || item.stock_value_after || 0),
          purchaseCount: 0,
          histories: [],
        });
      }

      const group = groups.get(key);
      group.purchaseCount += 1;
      group.histories.push({
        id: item.id,
        purchaseId: purchase.id,
        itemName: item.item_name,
        purchaseDate: purchase.purchase_date,
        supplierName: purchase.suplier_name,
        paymentMethod: purchase.payment_method,
        quantity: Number(item.quantity),
        unit: item.unit,
        unitPrice: Number(item.unit_price),
        total: Number(item.total),
        stockQuantity: Number(item.stock_quantity),
        stockUnit: item.stock_unit,
        stockAverageCost: Number(item.stock_unit_cost || 0),
        stockValueAfter: Number(item.stock_value_after || 0),
      });
    });
  });

  return Array.from(groups.values());
};

export const getLogActionLabel = (log) =>
  log.action === "create" ? "Tambah" : log.action === "delete" ? "Hapus" : "Edit";

export const getLogDetail = (log) =>
  log.action === "create"
    ? `${quantityDisplay(log.newData?.quantity, log.newData?.unit)} ditambahkan, harga ${currency(log.newData?.unitPrice)}`
    : log.action === "delete"
      ? `${quantityDisplay(log.oldData?.quantity, log.oldData?.unit)} dihapus`
      : `${quantityDisplay(log.oldData?.quantity, log.oldData?.unit)} -> ${quantityDisplay(log.newData?.quantity, log.newData?.unit)}, ${currency(log.oldData?.unitPrice)} -> ${currency(log.newData?.unitPrice)}`;
