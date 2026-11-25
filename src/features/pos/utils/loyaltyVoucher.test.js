import { describe, expect, it } from "vitest";
import { isLoyaltyVoucherCode, localPhone } from "./loyaltyVoucher";

describe("loyalty voucher", () => {
  it("recognizes a stamp card voucher QR, nothing else", () => {
    expect(isLoyaltyVoucherCode("NSKV1.NSK-000001-01.5.0123456789abcdef")).toBe(true);
    expect(isLoyaltyVoucherCode(" NSKV1.NSK-000001-01.10.0123456789ABCDEF\n")).toBe(true);

    expect(isLoyaltyVoucherCode("081234567890")).toBe(false);
    // With a time slot (the old QR that changed every minute).
    expect(isLoyaltyVoucherCode("NSKV1.NSK-000001-01.5.29872800.0123456789abcdef")).toBe(false);
    expect(isLoyaltyVoucherCode("NSKV1.NSK-000001-01.5.0123")).toBe(false);
    expect(isLoyaltyVoucherCode("NSKV1.NSK-000001-01.x.0123456789abcdef")).toBe(false);
    expect(isLoyaltyVoucherCode("https://example.com")).toBe(false);
    expect(isLoyaltyVoucherCode(null)).toBe(false);
  });

  it("writes the loyalty app's 62… number the way the cashier types it", () => {
    expect(localPhone("6281234567890")).toBe("081234567890");
    expect(localPhone("081234567890")).toBe("081234567890");
    expect(localPhone("")).toBe("");
  });
});
