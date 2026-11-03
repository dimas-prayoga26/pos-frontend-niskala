// Bahan setengah jadi (semi items, e.g. Nasi from Beras): previews for the
// forms. They mirror the backend (semi.repository.js), which stores the result.
import { parseCostInput } from "./stockItems";

const roundQuantity = (value) => Math.round((Number(value) || 0) * 10000) / 10000;
const roundPortions = (value) => Math.round((Number(value) || 0) * 100) / 100;
const roundCurrency = (value) => Math.round((Number(value) || 0) * 100) / 100;

const positive = (value) => {
  const number = parseCostInput(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

// "Beras, Garam": the bahan baku a semi item is cooked from.
export const describeBahan = (components = []) => components.map((component) => component.name).join(", ");

// Portions from one cooking, counted by the kitchen.
export const getProductionPortions = (portionQuantity) => roundPortions(positive(portionQuantity));

// Catat Masak starts from the latest cooking's quantities (the composition's).
export const getStartingQuantities = (item) =>
  Object.fromEntries(
    (item?.components || []).map((component) => [
      String(component.stockItemId),
      Number(component.quantity) > 0 ? String(component.quantity).replace(".", ",") : "",
    ])
  );

// Raw items a cooking uses: each bahan of the composition with the quantity
// typed for it (quantities by stockItemId), its cost, its stock now and
// whether it is short.
export const getProductionUsage = (item, quantities = {}, stockItems = []) => {
  const stockById = new Map(stockItems.map((stock) => [Number(stock.id || stock._id), stock]));

  return (item?.components || []).map((component) => {
    const stock = stockById.get(Number(component.stockItemId));
    const quantity = roundQuantity(positive(quantities[String(component.stockItemId)]));
    const unitCost = Number(stock?.averageCost ?? component.unitCost ?? 0);
    const available = Number(stock?.stock ?? 0);

    return {
      ...component,
      quantity,
      unitCost,
      cost: roundCurrency(quantity * unitCost),
      available,
      isUnlimited: Boolean(stock?.isUnlimited),
      isShort: !stock?.isUnlimited && quantity > available,
    };
  });
};

export const getUsageCost = (usage) =>
  roundCurrency(usage.reduce((total, used) => total + used.cost, 0));

// Value lost when quantity portions are thrown away: the exact unit cost
// (stock value / stock), as the backend writes it off.
export const getWasteCost = (item, quantity) => {
  const portions = roundPortions(positive(quantity));
  const stock = Number(item?.stock || 0);
  const stockValue = Number(item?.stockValue || 0);

  return stock > 0 && stockValue > 0
    ? roundCurrency((stockValue * portions) / stock)
    : roundCurrency(portions * Number(item?.averageCost || 0));
};

// Request body for saving a prepared item from the dialog form: its bahan
// baku only. Their quantities and the portion size come from Catat Masak;
// the unit stays porsi.
export const toPreparedPayload = (form) => ({
  name: form.name.trim(),
  // No minimum: a semi item is HARUS MASAK only when its stock is empty.
  minimumStock: 0,
  resetDaily: Boolean(form.resetDaily),
  components: [...new Set(form.components.map((component) => Number(component.stockItemId) || 0))]
    .filter((stockItemId) => stockItemId > 0)
    .map((stockItemId) => ({ stockItemId })),
});
