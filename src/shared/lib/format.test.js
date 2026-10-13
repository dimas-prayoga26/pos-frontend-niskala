import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatNominalInput,
  formatReceiptCurrency,
  getAvatarName,
  normalizeNominalInput,
} from "./format";
import {
  formatDate,
  formatDateAndTime,
  formatJakartaDate,
  formatJakartaDateTime,
  formatJakartaReceiptDate,
  formatJakartaReceiptDateTime,
  formatJakartaTime,
  getJakartaDateKey,
} from "./dates";

describe("currency and nominal input", () => {
  it("formats rupiah without decimals", () => {
    expect(formatCurrency(15000)).toBe("Rp 15.000");
    expect(formatCurrency("abc")).toBe("Rp 0");
    expect(formatCurrency(1234.6)).toBe("Rp 1.235");
  });

  it("formats receipt amounts with a plain space and rounding", () => {
    expect(formatReceiptCurrency(62700.4)).toBe("Rp 62.700");
    expect(formatReceiptCurrency(null)).toBe("Rp 0");
  });

  it("keeps only digits in nominal inputs and groups thousands", () => {
    expect(normalizeNominalInput("Rp 4.500,-")).toBe("4500");
    expect(normalizeNominalInput(undefined)).toBe("");
    expect(formatNominalInput("4500")).toBe("4.500");
    expect(formatNominalInput("")).toBe("");
  });

  it("builds avatar initials", () => {
    expect(getAvatarName("kasir uji coba")).toBe("KUC");
    expect(getAvatarName("")).toBe("");
  });
});

describe("Asia/Jakarta dates", () => {
  // 2026-01-04 18:30 UTC is 2026-01-05 01:30 in Jakarta (UTC+7).
  const lateUtc = "2026-01-04T18:30:00Z";

  it("derives the Jakarta calendar day", () => {
    expect(getJakartaDateKey(lateUtc)).toBe("2026-01-05");
    expect(getJakartaDateKey("2026-01-05")).toBe("2026-01-05");
    expect(getJakartaDateKey("2026-01-05 23:59:00")).toBe("2026-01-05");
    expect(getJakartaDateKey("not a date")).toBe("");
  });

  it("treats MySQL-style strings without offset as Jakarta time", () => {
    expect(formatJakartaTime("2026-01-05 08:15:30")).toBe("08:15:30");
    expect(formatJakartaTime("2026-01-05 08:15:30", { second: undefined })).toBe("08:15");
    expect(formatJakartaTime("x")).toBe("-");
  });

  it("formats display and receipt dates", () => {
    expect(formatJakartaDate(lateUtc)).toBe("January 05, 2026");
    expect(formatJakartaDateTime(lateUtc)).toBe("January 05, 2026 01:30");
    expect(formatJakartaReceiptDateTime(lateUtc)).toBe("05/01/26 01:30");
    expect(formatJakartaReceiptDate("2026-01-05")).toBe("05/01/2026");
    expect(formatJakartaReceiptDate("")).toBe("-");
    expect(formatDate(lateUtc)).toBe("January 05, 2026");
    expect(formatDateAndTime(lateUtc)).toBe("January 05, 2026 01:30");
  });
});
