import { describe, expect, it } from "vitest";
import {
  describeBahan,
  getProductionPortions,
  getProductionUsage,
  getStartingQuantities,
  getUsageCost,
  getWasteCost,
  toPreparedPayload,
} from "./preparedItems";

const cabai = { id: 2, name: "Cabai", unit: "gr", stock: 300, averageCost: 60 };
const sambal = {
  id: 9,
  name: "Sambal",
  unit: "porsi",
  portionSize: 25,
  components: [
    { stockItemId: 2, name: "Cabai", unit: "gr", quantity: 500, unitCost: 60 },
    { stockItemId: 3, name: "Garam", unit: "gr", quantity: 20, unitCost: 10 },
  ],
};

describe("prepared item utils", () => {
  it("names the bahan baku and starts Catat Masak from the latest quantities", () => {
    expect(describeBahan(sambal.components)).toBe("Cabai, Garam");
    expect(
      getStartingQuantities({ components: [...sambal.components, { stockItemId: 4, quantity: 0.5 }, { stockItemId: 5, quantity: 0 }] })
    ).toEqual({ 2: "500", 3: "20", 4: "0,5", 5: "" });
  });

  it("takes the portions counted after cooking", () => {
    expect(getProductionPortions("15")).toBe(15);
    expect(getProductionPortions("12,5")).toBe(12.5);
    expect(getProductionPortions("-1")).toBe(0);
    expect(getProductionPortions("")).toBe(0);
  });

  it("lists the raw items a cooking uses and flags short stock", () => {
    const usage = getProductionUsage(sambal, { 2: "500", 3: "20" }, [cabai]);

    expect(usage.map(({ name, quantity, unitCost, cost, isShort }) => [name, quantity, unitCost, cost, isShort])).toEqual([
      ["Cabai", 500, 60, 30000, true],
      ["Garam", 20, 10, 200, true],
    ]);
    expect(getUsageCost(usage)).toBe(30200);
    // A bahan left empty is not used this time.
    expect(getProductionUsage(sambal, { 2: "250,5", 3: "" }, [cabai, { id: 3, stock: 50, averageCost: 12 }]).map((used) => [used.quantity, used.cost, used.isShort])).toEqual([
      [250.5, 15030, false],
      [0, 0, false],
    ]);
  });

  it("builds the save payload from the dialog form", () => {
    expect(
      toPreparedPayload({
        name: " Nasi ",
        resetDaily: true,
        components: [{ stockItemId: "1" }, { stockItemId: "" }, { stockItemId: "2" }, { stockItemId: "1" }],
      })
    ).toEqual({
      name: "Nasi",
      minimumStock: 0,
      resetDaily: true,
      components: [{ stockItemId: 1 }, { stockItemId: 2 }],
    });
  });

  it("values thrown-away portions at the exact unit cost", () => {
    const nasi = { stock: 78, stockValue: 68250, averageCost: 875 };

    expect(getWasteCost(nasi, "8")).toBe(7000);
    expect(getWasteCost(nasi, "0,5")).toBe(437.5);
    expect(getWasteCost(nasi, "")).toBe(0);
    expect(getWasteCost({ stock: 0, stockValue: 0, averageCost: 900 }, "2")).toBe(1800);
  });
});
