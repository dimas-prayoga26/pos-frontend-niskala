// Inventory display formatting shared by stock items and purchases.
export const currency = (n) =>
  `Rp ${Math.round(Number(n || 0)).toLocaleString("id-ID", {
    maximumFractionDigits: 0,
  })}`;

export const quantityDisplay = (quantity, unit) =>
  `${Number(quantity || 0).toLocaleString("id-ID", {
    maximumFractionDigits: 2,
  })} ${unit || ""}`.trim();

export const costDisplay = (cost, unit) => {
  const normalizedUnit = String(unit || "").toLowerCase();
  const numericCost = Number(cost || 0);

  if (["gr", "g", "gram"].includes(normalizedUnit)) {
    return `${currency(numericCost)} / gr`;
  }

  if (["ml", "milliliter", "mililiter"].includes(normalizedUnit)) {
    return `${currency(numericCost)} / ml`;
  }

  return `${currency(numericCost)} / ${unit || "unit"}`;
};

// Unit label used for costs: gram/milliliter variants become "gr"/"ml".
export const displayCostUnit = (unit) => {
  const normalizedUnit = String(unit || "").toLowerCase();
  if (["gr", "g", "gram"].includes(normalizedUnit)) return "gr";
  if (["ml", "milliliter", "mililiter"].includes(normalizedUnit)) return "ml";
  return unit || "unit";
};

// Saldo can be negative: "-Rp 7.000" rather than "Rp -7.000".
export const signedCurrency = (n) =>
  Number(n || 0) < 0 ? `-${currency(-Number(n))}` : currency(n);

// Digits-only rupiah input shown with thousand separators ("40.000").
export const formatRupiahInput = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");

  return digits ? Number(digits).toLocaleString("id-ID") : "";
};
