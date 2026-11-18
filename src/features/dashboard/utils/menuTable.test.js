import { describe, expect, it } from "vitest";
import { buildMenuRows, trendRanges } from "./menuTable";

const previousRange = (...args) => trendRanges(...args)?.previous ?? null;

// Noon in Jakarta.
const on = (key) => new Date(`${key}T05:00:00Z`);

describe("trendRanges", () => {
  it("covers the period up to today", () => {
    expect(trendRanges("week", { from: "2026-11-16", to: "2026-11-22" }, on("2026-11-18"))).toEqual({
      current: { from: "2026-11-16", to: "2026-11-18" },
      previous: { from: "2026-11-09", to: "2026-11-11" },
    });
    expect(trendRanges("custom", { from: "2026-11-10", to: "2026-11-14" }, on("2026-11-18")).current).toEqual({
      from: "2026-11-10",
      to: "2026-11-14",
    });
  });

  it("compares a calendar period with the same days one period back, up to today", () => {
    expect(previousRange("today", { from: "2026-11-18", to: "2026-11-18" }, on("2026-11-18"))).toEqual({
      from: "2026-11-17",
      to: "2026-11-17",
    });
    expect(previousRange("week", { from: "2026-11-16", to: "2026-11-22" }, on("2026-11-18"))).toEqual({
      from: "2026-11-09",
      to: "2026-11-11",
    });
    expect(previousRange("month", { from: "2026-11-01", to: "2026-11-30" }, on("2026-11-18"))).toEqual({
      from: "2026-10-01",
      to: "2026-10-18",
    });
    expect(previousRange("year", { from: "2026-01-01", to: "2026-12-31" }, on("2026-11-18"))).toEqual({
      from: "2025-01-01",
      to: "2025-11-18",
    });
  });

  it("keeps a shifted day inside its month", () => {
    expect(previousRange("month", { from: "2026-03-01", to: "2026-03-31" }, on("2026-03-31"))).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
    expect(previousRange("year", { from: "2028-01-01", to: "2028-12-31" }, on("2028-02-29"))).toEqual({
      from: "2027-01-01",
      to: "2027-02-28",
    });
  });

  it("takes as many days right before a custom range", () => {
    expect(previousRange("custom", { from: "2026-11-10", to: "2026-11-14" }, on("2026-11-18"))).toEqual({
      from: "2026-11-05",
      to: "2026-11-09",
    });
    // Only the days up to today count.
    expect(previousRange("custom", { from: "2026-11-15", to: "2026-11-30" }, on("2026-11-18"))).toEqual({
      from: "2026-11-11",
      to: "2026-11-14",
    });
  });

  it("has nothing to compare for all time, an open or a future range", () => {
    expect(previousRange("all", {}, on("2026-11-18"))).toBeNull();
    expect(previousRange("custom", { from: "2026-11-01" }, on("2026-11-18"))).toBeNull();
    expect(previousRange("custom", { from: "2026-12-01", to: "2026-12-31" }, on("2026-11-18"))).toBeNull();
  });
});

describe("buildMenuRows", () => {
  const menu = (name, group, numberOfOrders, revenue) => ({ id: name, name, group, numberOfOrders, revenue });
  const menus = [menu("Es Teh", "Minuman", 5, 40000), menu("Nasi Goreng", "Makanan", 3, 75000), menu("Mie Goreng", "Makanan", 2, 44000)];

  it("ranks by omzet or qty, with each menu's share of the whole omzet", () => {
    expect(buildMenuRows(menus, null).map((row) => [row.rank, row.name, row.share.toFixed(3), row.trend])).toEqual([
      [1, "Nasi Goreng", "0.472", null],
      [2, "Mie Goreng", "0.277", null],
      [3, "Es Teh", "0.252", null],
    ]);
    expect(buildMenuRows(menus, null, { sortKey: "numberOfOrders" }).map((row) => row.name)).toEqual([
      "Es Teh",
      "Nasi Goreng",
      "Mie Goreng",
    ]);
  });

  it("filters a kind but keeps the share of the whole omzet", () => {
    const rows = buildMenuRows(menus, null, { group: "Makanan" });
    expect(rows.map((row) => [row.rank, row.name, row.share.toFixed(3)])).toEqual([
      [1, "Nasi Goreng", "0.472"],
      [2, "Mie Goreng", "0.277"],
    ]);
  });

  it("lets equal menus share a rank, the other measure ordering them", () => {
    const tied = [menu("A", "Snack", 2, 10000), menu("B", "Snack", 2, 30000), menu("C", "Snack", 1, 5000)];
    expect(buildMenuRows(tied, null, { sortKey: "numberOfOrders" }).map((row) => [row.rank, row.name])).toEqual([
      [1, "B"],
      [1, "A"],
      [3, "C"],
    ]);
  });

  it("works out the omzet trend from the period before, by menu name", () => {
    const before = [menu("nasi goreng", "Makanan", 2, 50000), menu("Es Teh", "Minuman", 10, 80000)];
    const trends = Object.fromEntries(buildMenuRows(menus, before).map((row) => [row.name, row.trend]));
    expect(trends).toEqual({ "Nasi Goreng": 0.5, "Es Teh": -0.5, "Mie Goreng": "new" });
  });
});
