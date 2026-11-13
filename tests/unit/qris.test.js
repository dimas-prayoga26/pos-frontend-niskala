import { describe, expect, it } from "vitest";
import { buildDynamicQRIS } from "../../src/features/pos/utils/qris";

// CRC-16/CCITT-FALSE, as QRIS signs its payload (tag 63).
const crcOf = (value) => {
  let crc = 0xffff;
  for (const character of value) {
    crc ^= character.charCodeAt(0) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
};

describe("QRIS", () => {
  it("locks the order total into the cafe's QRIS (NMID ID2026579014351)", () => {
    const qris = buildDynamicQRIS(25000);

    // Dynamic (12), the cafe's merchant and terminal, the amount before the country.
    expect(qris.startsWith("000201010212")).toBe(true);
    expect(qris).toContain("0215ID2026579014351");
    expect(qris).toContain("5917NISKALA COFFEE QR");
    expect(qris).toContain("0703A01");
    expect(qris).toContain("53033605405250005802ID");
    // Signed again over everything before the CRC.
    expect(qris.slice(-4)).toBe(crcOf(qris.slice(0, -4)));
  });

  it("makes no QR without an amount", () => {
    expect(buildDynamicQRIS(0)).toBe("");
  });
});
