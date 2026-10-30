import { describe, expect, it } from "vitest";
import { formatDayMonthYear } from "../../src/shared/lib/dates";

describe("formatDayMonthYear", () => {
  it("shows a stored day as tanggal, nama bulan, tahun", () => {
    expect(formatDayMonthYear("2026-10-29")).toBe("29 Oktober 2026");
    expect(formatDayMonthYear("2026-01-05")).toBe("5 Januari 2026");
  });

  it("keeps the day of a datetime as written, whatever the time", () => {
    expect(formatDayMonthYear("2026-12-31 23:59:59")).toBe("31 Desember 2026");
    expect(formatDayMonthYear("2026-03-01 00:00:00")).toBe("1 Maret 2026");
  });

  it("leaves anything else as it is", () => {
    expect(formatDayMonthYear(null)).toBe("-");
    expect(formatDayMonthYear("")).toBe("-");
    expect(formatDayMonthYear("kemarin")).toBe("kemarin");
  });
});
