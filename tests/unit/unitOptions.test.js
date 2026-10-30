import { describe, expect, it } from "vitest";
import { UNIT_OPTIONS, unitOptionsFor } from "../../src/features/inventory/utils/shopping";

const ids = (...args) => unitOptionsFor(...args).map((option) => option.id);

describe("unitOptionsFor", () => {
  it("offers every unit for a new bahan", () => {
    expect(unitOptionsFor()).toBe(UNIT_OPTIONS);
  });

  it("offers only the stock unit and the units converted into it", () => {
    // Air Isi Ulang is stocked in galon: ml cannot become galon.
    expect(ids("galon", "galon")).toEqual(["galon"]);
    expect(ids("gram")).toEqual(["gr"]);
    expect(ids("kg", "kg")).toEqual(["kg", "gr"]);
    expect(ids("liter")).toEqual(["liter", "ml"]);
    expect(ids("pcs", "pcs")).toEqual(["pcs"]);
  });

  it("keeps the unit a line already has, e.g. a package", () => {
    expect(ids("botol", "dus")).toEqual(["botol", "dus"]);
  });

  it("returns the same options between renders", () => {
    expect(unitOptionsFor("galon", "galon")).toBe(unitOptionsFor("galon", "galon"));
  });
});
