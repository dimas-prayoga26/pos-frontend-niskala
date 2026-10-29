import { describe, expect, it } from "vitest";
import { costDisplay, currency, formatRupiahInput, quantityDisplay } from "./format";
import { buildPurchasePayload, getLogDetail, isPurchaseFormComplete, lineTotal, parseShoppingQuantity, purchaseUnitForStockUnit, unitPriceFromTotal } from "./shopping";

describe("shopping utils", () => {
  it("parses decimal, comma and fraction quantities", () => {
    expect(parseShoppingQuantity("1.5")).toBe(1.5);
    expect(parseShoppingQuantity("1,5")).toBe(1.5);
    expect(parseShoppingQuantity(" 1 / 4 ")).toBe(0.25);
    expect(parseShoppingQuantity("1/0")).toBeNaN();
    expect(parseShoppingQuantity("")).toBeNaN();
  });

  it("derives the unit price from the typed line total", () => {
    expect(unitPriceFromTotal(2.5, "40000")).toBe(16000);
    expect(unitPriceFromTotal(0.5, 15000)).toBe(15000);
    expect(unitPriceFromTotal(3, 10000)).toBe(3333.33);
    expect(lineTotal({ unitPrice: "15000" })).toBe(15000);
  });

  it("formats figures for the history tables", () => {
    expect(currency(1234.6)).toBe("Rp 1.235");
    expect(quantityDisplay(1500.257, "gr")).toBe("1.500,26 gr");
    expect(quantityDisplay(2, "")).toBe("2");
    expect(costDisplay(14.5, "gram")).toBe("Rp 15 / gr");
    expect(costDisplay(3, "")).toBe("Rp 3 / unit");
    expect(formatRupiahInput("Rp 40.000")).toBe("40.000");
    expect(purchaseUnitForStockUnit("Gram")).toBe("gr");
    expect(purchaseUnitForStockUnit("liter")).toBe("liter");
  });

  it("validates the form and sends draft names instead of ids", () => {
    const rows = [
      { stockItemId: 5, quantity: "2", unit: "gr", unitPrice: "30000" },
      { stockItemId: "draft:cup", quantity: "1/2", unit: "pcs", unitPrice: "1000" },
    ];
    const form = { date: "2026-09-15", suplierId: "draft:pasar", paymentSourceId: 1, note: "" };
    expect(isPurchaseFormComplete(form, rows)).toBe(true);
    expect(isPurchaseFormComplete({ ...form, suplierId: "" }, rows)).toBe(false);
    expect(isPurchaseFormComplete(form, [{ ...rows[0], quantity: "0" }])).toBe(false);

    expect(
      buildPurchasePayload(form, rows, {
        extraSuppliers: [{ id: "draft:pasar", name: "Pasar" }],
        extraItems: [{ id: "draft:cup", name: "Cup", unit: "" }],
      })
    ).toEqual({
      date: "2026-09-15",
      paymentSourceId: 1,
      note: "",
      suplierName: "Pasar",
      items: [
        { stockItemId: 5, quantity: 2, unit: "gr", unitPrice: 15000 },
        { itemName: "Cup", quantity: 0.5, unit: "pcs", unitPrice: 1000 },
      ],
    });
  });

  it("describes activity log entries", () => {
    expect(getLogDetail({ action: "delete", oldData: { quantity: 2, unit: "gr" } })).toBe("2 gr dihapus");
  });
});
