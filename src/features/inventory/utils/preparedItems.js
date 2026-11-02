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

// Composition line cost at the raw item's current cost (whole rupiah).
export const getComponentCost = (quantity, stockItem) =>
  Math.round(roundQuantity(positive(quantity)) * Number(stockItem?.averageCost || 0));

// "10x masak": how many recipes (batch_quantity) one cooking made. The UI
// says "1x masak" for one recipe, so it is not mistaken for a menu recipe.
export const batchDisplay = (batchQuantity) =>
  `${Number(batchQuantity || 0).toLocaleString("id-ID", { maximumFractionDigits: 2 })}x masak`;

// "Beras 1 kg, Garam 5 gr" for one recipe.
export const describeComposition = (components = []) =>
  components
    .map((component) =>
      `${component.name} ${Number(component.quantity).toLocaleString("id-ID", {
        maximumFractionDigits: 4,
      })} ${component.unit || ""}`.trim()
    )
    .join(", ");

// Portions from one cooking, counted by the kitchen.
export const getProductionPortions = (portionQuantity) => roundPortions(positive(portionQuantity));

// Raw items used by batchQuantity recipes, with their cost, their stock now
// and whether it is short.
export const getProductionUsage = (item, batchQuantity, stockItems = []) => {
  const batch = positive(batchQuantity);
  const stockById = new Map(stockItems.map((stock) => [Number(stock.id || stock._id), stock]));

  return (item?.components || []).map((component) => {
    const stock = stockById.get(Number(component.stockItemId));
    const quantity = roundQuantity(batch * Number(component.quantity || 0));
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

// Request body for saving a prepared item from the dialog form.
export const toPreparedPayload = (form) => ({
  name: form.name.trim(),
  unit: form.unit.trim() || "porsi",
  portionSize: positive(form.portionSize),
  // No minimum: a semi item is HARUS MASAK only when its stock is empty.
  minimumStock: 0,
  resetDaily: Boolean(form.resetDaily),
  components: form.components
    .map((component) => ({
      stockItemId: Number(component.stockItemId) || 0,
      quantity: roundQuantity(positive(component.quantity)),
    }))
    .filter((component) => component.stockItemId > 0 && component.quantity > 0),
});
