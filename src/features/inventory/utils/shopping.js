import { currency, quantityDisplay } from "./format";
import { areConvertible, measuredBaseUnit } from "./units";

// Purchase (belanja) helpers. The form asks for the TOTAL price of a line; the
// API expects a unit price, so it is derived as total / quantity.
export const UNIT_OPTIONS = ["gr", "pcs", "ml"].map((unit) => ({ id: unit, text: unit }));
export const HISTORY_PAGE_SIZE = 10;

let rowKey = 0;

// stockItemId holds the chosen item of either Jenis Belanja; merkId its merk
// (optional, "draft:" for a new one); category is only asked for a new barang
// lainnya. packSize/packUnit (Isi per Kemasan, bahan
// baku: the qty is packages of packSize packUnit each) are no longer asked by
// the form; they only stay on a draft saved with them.
export const blankRow = () => ({
  key: ++rowKey,
  stockItemId: "",
  merkId: "",
  category: "",
  quantity: "",
  unit: "",
  packSize: "",
  packUnit: "",
  unitPrice: "",
});

// "1 dus (isi 24 botol)", or "2.000 gr" for a line bought without isi.
export const packedQuantityLabel = (quantity, unit, packSize, packUnit) =>
  packSize
    ? `${quantityDisplay(quantity, unit)} (isi ${quantityDisplay(packSize, packUnit)})`
    : quantityDisplay(quantity, unit);

// Per Item rows: the purchases of a barang apart per kemasan, so Beras by
// weight (kg and gr together), Beras per karung isi 5 kg and per kantong isi
// 3 kg are three rows, each with only its own purchases (newest first, as the
// group has them). kemasan is { unit, packSize, packUnit } or null.
export const splitByKemasan = (groups) =>
  groups.flatMap((group) => {
    const rows = new Map();
    group.histories.forEach((history) => {
      const packed = history.packSize != null;
      const kemasanKey = packed ? `${history.unit}|${history.packSize}` : "";
      if (!rows.has(kemasanKey)) {
        rows.set(kemasanKey, {
          ...group,
          kemasanKey,
          kemasan: packed ? { unit: history.unit, packSize: history.packSize, packUnit: history.stockUnit } : null,
          histories: [],
        });
      }
      rows.get(kemasanKey).histories.push(history);
    });
    return [...rows.values()].map((row) => ({ ...row, purchaseCount: row.histories.length }));
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

// The Satuan a line of a bahan may be bought in: its stock unit (galon, pack,
// ... from the rekap import too) and the units the server converts into it
// (gr and kg, ml and liter), plus the unit the line already has (a draft or a
// line bought by the package). A new bahan (no stock unit) takes any of
// UNIT_OPTIONS. Cached, so the select keeps the same options between renders.
const unitOptionsCache = new Map();
export const unitOptionsFor = (stockUnit, currentUnit = "") => {
  const stock = purchaseUnitForStockUnit(String(stockUnit || "").trim().toLowerCase());
  const current = String(currentUnit || "").trim();
  if (!stock && !current) return UNIT_OPTIONS;
  const key = `${stock}|${current}`;
  if (!unitOptionsCache.has(key)) {
    const units = stock
      ? [stock, ...UNIT_OPTIONS.map((option) => option.id).filter((unit) => areConvertible(unit, stock))]
      : UNIT_OPTIONS.map((option) => option.id);
    unitOptionsCache.set(
      key,
      [...new Set([...units, ...(current ? [current] : [])])].map((unit) => ({ id: unit, text: unit }))
    );
  }
  return unitOptionsCache.get(key);
};

// Edit Belanja also offers pcs for a bahan stocked in ml or gr (10 pcs isi
// 1.000 ml); a pcs needs its isi then. A bahan counted in pcs (or botol, ...)
// is offered gr and ml too: weighed from then on.
const editUnitOptionsCache = new Map();
export const editUnitOptionsFor = (stockUnit, currentUnit = "") => {
  const options = unitOptionsFor(stockUnit, currentUnit);
  if (!editUnitOptionsCache.has(options)) {
    const counted = Boolean(stockUnit) && !measuredBaseUnit(stockUnit);
    const extra = ["pcs", ...(counted ? ["gr", "ml"] : [])].filter(
      (unit) => !options.some((option) => option.id === unit)
    );
    editUnitOptionsCache.set(options, extra.length ? [...options, ...extra.map((unit) => ({ id: unit, text: unit }))] : options);
  }
  return editUnitOptionsCache.get(options);
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
// or supplyItemId (perlengkapan). merkPayloadOf turns a line's merkId into
// { merkId }, { merkName } (new) or {} (useMerkOptions).
export const buildPurchasePayload = (
  form,
  rows,
  { extraSuppliers, extraItems, itemIdKey = "stockItemId", merkPayloadOf = () => ({}) }
) => {
  const supplierDraft = extraSuppliers.find((item) => item.id === form.suplierId);
  const { suplierId, ...details } = form;
  // Jenis Belanja picks the endpoint; it is not part of the nota.
  delete details.kind;

  return {
    ...details,
    ...(supplierDraft ? { suplierName: supplierDraft.name } : { suplierId }),
    items: rows.map(({ stockItemId, merkId, category, quantity, unit, packSize, packUnit, unitPrice }) => {
      const draft = extraItems.find((item) => item.id === stockItemId);
      const parsedQuantity = parseShoppingQuantity(quantity);

      return {
        ...(draft
          ? { itemName: draft.name, ...(category && { category }) }
          : { [itemIdKey]: stockItemId }),
        ...merkPayloadOf(merkId),
        quantity: parsedQuantity,
        // Lines without unit (barang Lainnya) take their item's unit on the server.
        ...(unit && { unit }),
        // Isi per Kemasan; packUnit only for a new item (an item keeps its stock unit).
        ...(String(packSize || "").trim() && {
          packSize: parseShoppingQuantity(packSize),
          ...(draft && packUnit && { packUnit }),
        }),
        unitPrice: unitPriceFromTotal(parsedQuantity, unitPrice),
        // The harga total as typed: the server keeps it even when the price per
        // gr or ml has more than 2 decimals (19.000 ml for Rp 8.000).
        total: lineTotal({ unitPrice }),
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
