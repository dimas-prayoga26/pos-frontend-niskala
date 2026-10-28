import { describe, expect, it } from "vitest";
import {
  describeComposition,
  getComponentCost,
  getProductionPortions,
  getProductionUsage,
  getUsageCost,
  getWasteCost,
  toPreparedPayload,
} from "./preparedItems";

const beras = { id: 1, name: "Beras", unit: "kg", stock: 10, averageCost: 14000 };
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
  it("costs a composition line at the raw item's current cost", () => {
    expect(getComponentCost("1", beras)).toBe(14000);
    expect(getComponentCost("0,5", beras)).toBe(7000);
    expect(getComponentCost("", beras)).toBe(0);
    expect(getComponentCost("2", undefined)).toBe(0);
    expect(describeComposition(sambal.components)).toBe("Cabai 500 gr, Garam 20 gr");
  });

  it("finds portions from the weighed result or a direct count", () => {
    expect(getProductionPortions({ mode: "weight", outputWeight: "12000" }, 150)).toBe(80);
    expect(getProductionPortions({ mode: "weight", outputWeight: "750" }, 25)).toBe(30);
    expect(getProductionPortions({ mode: "weight", outputWeight: "100" }, 150)).toBe(0.67);
    expect(getProductionPortions({ mode: "weight", outputWeight: "750" }, 0)).toBe(0);
    expect(getProductionPortions({ mode: "count", portionQuantity: "15" }, 150)).toBe(15);
    expect(getProductionPortions({ mode: "count", portionQuantity: "-1" }, 150)).toBe(0);
  });

  it("lists the raw items a cooking uses and flags short stock", () => {
    const usage = getProductionUsage(sambal, "1", [cabai]);

    expect(usage.map(({ name, quantity, unitCost, cost, isShort }) => [name, quantity, unitCost, cost, isShort])).toEqual([
      ["Cabai", 500, 60, 30000, true],
      ["Garam", 20, 10, 200, true],
    ]);
    expect(getUsageCost(usage)).toBe(30200);
    expect(getProductionUsage(sambal, "0,5", [cabai, { id: 3, stock: 50, averageCost: 12 }]).map((used) => [used.quantity, used.cost, used.isShort])).toEqual([
      [250, 15000, false],
      [10, 120, false],
    ]);
  });

  it("builds the save payload from the dialog form", () => {
    expect(
      toPreparedPayload({
        name: " Nasi ",
        unit: "",
        portionSize: "150",
        minimumStock: "",
        resetDaily: true,
        components: [
          { stockItemId: "1", quantity: "1" },
          { stockItemId: "", quantity: "2" },
          { stockItemId: "2", quantity: "0" },
        ],
      })
    ).toEqual({
      name: "Nasi",
      unit: "porsi",
      portionSize: 150,
      minimumStock: 0,
      resetDaily: true,
      components: [{ stockItemId: 1, quantity: 1 }],
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
