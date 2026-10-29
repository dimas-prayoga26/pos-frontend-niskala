import { describe, expect, it } from "vitest";
import { computeNotaTotals, parsePercent } from "./notaTotals";

// Same numbers as pos-backend tests/unit/notaTotals.test.js: the form must
// show the Grand Total the server will post.
describe("computeNotaTotals", () => {
  it("applies diskon %, PPN on the discounted subtotal and ongkir", () => {
    expect(
      computeNotaTotals([100000, 50000], { shippingCost: 15000, discountType: "percent", discountValue: 10, taxPercent: 11 })
    ).toEqual({ subtotal: 150000, discountAmount: 15000, taxAmount: 14850, shippingCost: 15000, total: 164850 });
  });

  it("caps a diskon in rupiah at the subtotal and keeps a plain nota unchanged", () => {
    expect(computeNotaTotals([1000], { discountType: "amount", discountValue: 5000 }).total).toBe(0);
    expect(computeNotaTotals([1500.5, 2000]).total).toBe(3500.5);
  });

  it("reads percentages with a comma", () => {
    expect(parsePercent("11,5")).toBe(11.5);
    expect(parsePercent("")).toBe(0);
    expect(parsePercent("abc")).toBeNaN();
  });
});
