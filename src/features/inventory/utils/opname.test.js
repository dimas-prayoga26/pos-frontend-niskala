import { describe, expect, it } from "vitest";
import { getOpnameLine, isCountable, shrinkageLabel, valueChangeDisplay } from "./opname";

const susu = { stock: 800, stockValue: 20488, averageCost: 26 };

describe("stock opname lines", () => {
  it("skips a bahan with nothing typed and refuses a count below 0", () => {
    expect(getOpnameLine(susu, "")).toBeNull();
    expect(getOpnameLine(susu, "  ")).toBeNull();
    expect(getOpnameLine(susu, "-1")).toEqual({ isInvalid: true });
    expect(getOpnameLine(susu, "abc")).toEqual({ isInvalid: true });
  });

  it("values a kurang at stock value / stock and a lebih back at the same cost", () => {
    expect(getOpnameLine(susu, "700")).toMatchObject({ difference: 100, cost: 2561 });
    expect(getOpnameLine(susu, "0")).toMatchObject({ difference: 800, cost: 20488 });
    expect(getOpnameLine(susu, "850,5")).toMatchObject({ actualStock: 850.5, difference: -50.5, cost: -1293.31 });
    expect(getOpnameLine(susu, "800")).toMatchObject({ difference: 0, cost: 0 });
  });

  it("uses the latest unit cost when the system stock is 0 or below", () => {
    const sold = { stock: -5, stockValue: 0, averageCost: 1000 };
    expect(getOpnameLine(sold, "3")).toMatchObject({ difference: -8, cost: -3000 });
    expect(getOpnameLine(sold, "0")).toMatchObject({ difference: -5, cost: 0 });
  });

  it("shows a kurang as value lost and a lebih as value gained", () => {
    expect(valueChangeDisplay(2561)).toBe("-Rp 2.561");
    expect(valueChangeDisplay(-13180)).toBe("+Rp 13.180");
    expect(valueChangeDisplay(0)).toBe("Rp 0");
    expect(shrinkageLabel(561)).toBe("Kehilangan Persediaan");
    expect(shrinkageLabel(0)).toBe("Kehilangan Persediaan");
    expect(shrinkageLabel(-13180)).toBe("Kelebihan Persediaan");
  });

  it("counts Bahan Resep and bahan olahan only, never Bebas Stok", () => {
    expect(isCountable({ isUnlimited: true })).toBe(false);
    expect(isCountable({ isRecipeIngredient: false })).toBe(false);
    expect(isCountable({ ...susu, isRecipeIngredient: true })).toBe(true);
    expect(isCountable(susu)).toBe(true);
  });
});
