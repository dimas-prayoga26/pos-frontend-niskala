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

// "Beras 1 kg, Garam 5 gr" for one recipe.
export const describeComposition = (components = []) =>
  components
    .map((component) =>
      `${component.name} ${Number(component.quantity).toLocaleString("id-ID", {
        maximumFractionDigits: 4,
      })} ${component.unit || ""}`.trim()
    )
    .join(", ");

// Portions from one cooking: weighed result / portion size, or counted.
export const getProductionPortions = ({ mode, outputWeight, portionQuantity }, portionSize) => {
  if (mode === "weight") {
    const weight = positive(outputWeight);
    return portionSize > 0 && weight > 0 ? roundPortions(weight / portionSize) : 0;
  }

  return roundPortions(positive(portionQuantity));
};

// Raw items used by batchQuantity recipes, with their cost and whether the
// stock is short.
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
      isShort: !stock?.isUnlimited && quantity > available,
    };
  });
};

export const getUsageCost = (usage) =>
  roundCurrency(usage.reduce((total, used) => total + used.cost, 0));

// Request body for saving a prepared item from the dialog form.
export const toPreparedPayload = (form) => ({
  name: form.name.trim(),
  unit: form.unit.trim() || "porsi",
  portionSize: positive(form.portionSize),
  minimumStock: positive(form.minimumStock),
  components: form.components
    .map((component) => ({
      stockItemId: Number(component.stockItemId) || 0,
      quantity: roundQuantity(positive(component.quantity)),
    }))
    .filter((component) => component.stockItemId > 0 && component.quantity > 0),
});
