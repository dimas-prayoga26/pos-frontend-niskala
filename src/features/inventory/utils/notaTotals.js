// Ringkasan of the purchase form; mirrors pos-backend shopping.totals so the
// Grand Total shown is the one that leaves the saldo. Subtotal (the lines),
// Diskon Nota (Rp or %, at most the subtotal), PPN on the discounted
// subtotal, plus Ongkos Kirim.
const cents = (value) => Math.round(Number(value || 0) * 100);

export const DEFAULT_TAX_PERCENT = 11;

export const computeNotaTotals = (
  lineTotals,
  { shippingCost = 0, discountType = "amount", discountValue = 0, taxPercent = 0 } = {}
) => {
  const subtotal = lineTotals.reduce((total, line) => total + cents(line), 0);
  const discount = Math.min(
    discountType === "percent" ? Math.round((subtotal * Number(discountValue || 0)) / 100) : cents(discountValue),
    subtotal
  );
  const tax = Math.round(((subtotal - discount) * Number(taxPercent || 0)) / 100);
  const shipping = cents(shippingCost);

  return {
    subtotal: subtotal / 100,
    discountAmount: discount / 100,
    taxAmount: tax / 100,
    shippingCost: shipping / 100,
    total: (subtotal - discount + tax + shipping) / 100,
  };
};

// "11", "11,5" and "" (0) are accepted for percentages.
export const parsePercent = (value) => {
  const number = Number(String(value ?? "").trim().replace(",", ".") || 0);
  return Number.isFinite(number) ? number : NaN;
};
