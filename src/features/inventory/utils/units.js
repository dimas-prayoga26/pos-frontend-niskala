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

export const isKnownUnit = (unit) => Boolean(UNIT_CONVERSIONS[unitKey(unit)]);

export const areConvertible = (from, to) => {
  const a = UNIT_CONVERSIONS[unitKey(from)];
  const b = UNIT_CONVERSIONS[unitKey(to)];
  return Boolean(a && b && a[0] === b[0]);
};

// How many `to` make 1 `from` when the server converts them (1 kg = 1000 gr),
// else null.
export const knownUnitFactor = (from, to) =>
  areConvertible(from, to) ? UNIT_CONVERSIONS[unitKey(from)][1] / UNIT_CONVERSIONS[unitKey(to)][1] : null;
