// Units the server converts on its own (pos-backend shared/utils/units.js):
// family and factor to the family's base unit. Any other pair (galon and ml)
// needs its isi from the user.
const UNIT_CONVERSIONS = {
  kg: ["mass", 1000],
  gr: ["mass", 1],
  g: ["mass", 1],
  gram: ["mass", 1],
  l: ["volume", 1000],
  liter: ["volume", 1000],
  litre: ["volume", 1000],
  ml: ["volume", 1],
  pcs: ["pieces", 1],
  pc: ["pieces", 1],
  buah: ["pieces", 1],
};

const unitKey = (unit) => String(unit || "").trim().toLowerCase();

export const areConvertible = (from, to) => {
  const a = UNIT_CONVERSIONS[unitKey(from)];
  const b = UNIT_CONVERSIONS[unitKey(to)];
  return Boolean(a && b && a[0] === b[0]);
};

export const isSameUnit = (a, b) => unitKey(a) === unitKey(b);

// A purchase unit the stock unit cannot be converted from (pcs of minyak in
// ml, dus of Aqua in botol) needs its isi: how much stock one of it holds.
export const needsIsi = (unit, stockUnit) =>
  Boolean(unit && stockUnit) && !isSameUnit(unit, stockUnit) && !areConvertible(unit, stockUnit);

// quantity `from` expressed in `to` (20,2 liter = 20.200 ml), as the server
// converts a purchase line into its stock unit; null when it would refuse.
export const convertQuantity = (quantity, from, to) => {
  if (isSameUnit(from, to)) return quantity;
  if (!areConvertible(from, to)) return null;
  return (quantity * UNIT_CONVERSIONS[unitKey(from)][1]) / UNIT_CONVERSIONS[unitKey(to)][1];
};
