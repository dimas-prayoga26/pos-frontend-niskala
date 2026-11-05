import { currency } from "./format";
import { isRecipeIngredient, parseCostInput } from "./stockItems";

const roundStock = (value) => Math.round((Number(value) || 0) * 100) / 100;
const roundCurrency = (value) => Math.round((Number(value) || 0) * 100) / 100;

// Bahan that can be counted: bahan olahan and the Bahan Resep among bahan
// baku, but not those whose stock is not tracked (Bebas Stok).
export const isCountable = (item) => !item?.isUnlimited && isRecipeIngredient(item);

// Stock Opname (Modul 3): the physical count typed for a bahan (fisik)
// against its system stock. null when nothing is typed. difference =
// sistem - fisik (> 0 kurang, < 0 lebih); cost is the stock value it takes
// away, the Kehilangan Persediaan (< 0 for a selisih lebih), as the backend
// counts it (opname.repository): at stock value / stock, or at the latest
// unit cost when the system stock is 0 or below.
export const getOpnameLine = (item, input) => {
  if (String(input ?? "").trim() === "") return null;

  const parsed = parseCostInput(input);
  if (!Number.isFinite(parsed) || parsed < 0) return { isInvalid: true };

  const actualStock = roundStock(parsed);
  const stock = Number(item?.stock || 0);
  const systemStock = roundStock(stock);
  const difference = roundStock(systemStock - actualStock);
  const value = Number(item?.stockValue || 0);
  const unitCost = stock > 0 && value > 0 ? value / stock : Number(item?.averageCost || 0);
  const nextValue =
    stock > 0
      ? Math.max(roundCurrency(value - (stock - actualStock) * unitCost), 0)
      : roundCurrency(actualStock * unitCost);

  return { isInvalid: false, systemStock, actualStock, difference, cost: roundCurrency(value - nextValue) };
};

// A selisih shown as the change in stock value: "-Rp 2.561" for a kurang
// (the value lost), "+Rp 2.000" for a lebih.
export const valueChangeDisplay = (cost) =>
  cost > 0 ? `-${currency(cost)}` : cost < 0 ? `+${currency(-cost)}` : currency(0);

// A total that gains value reads as Kelebihan Persediaan rather than a
// negative Kehilangan Persediaan.
export const shrinkageLabel = (cost) => (cost < 0 ? "Kelebihan Persediaan" : "Kehilangan Persediaan");
