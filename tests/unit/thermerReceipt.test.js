import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/https/index";
import { printOrderReceipt } from "../../src/components/invoice/Invoice";
import { isAndroidDevice } from "../../src/utils/printReceipt";
import {
  DEFAULT_RECEIPT_PAPER_WIDTH,
  buildReceiptPrintHtml,
  buildThermerReceiptEntries,
  getReceiptPaperSize,
  getReceiptPaperWidth,
  setReceiptPaperWidth,
  toPrinterText,
  wrapText,
} from "../../src/utils/thermerReceipt";

vi.mock("../../src/https/index", async (importOriginal) => ({
  ...(await importOriginal()),
  createThermalPrintUrl: vi.fn(),
  createDraftThermalPrintUrl: vi.fn(),
}));

vi.mock("../../src/utils/printReceipt", async (importOriginal) => ({
  ...(await importOriginal()),
  isAndroidDevice: vi.fn(() => true),
  openBluetoothPrintApp: vi.fn(() => () => {}),
}));

const order = {
  id: 7,
  _id: 7,
  orderId: "2611-0007",
  orderType: "Offline",
  customerDetails: { name: "Meja 3", phone: "081234567890" },
  orderDate: "2026-11-12 10:00:00",
  items: [
    { name: "Kopi Susu", variant: "Large / Ice", quantity: 2, price: 36000, addOns: [{ name: "Extra Shot" }] },
    {
      name: "Rice Bowl Ayam Black Pepper Saus Pedas",
      quantity: 12,
      price: 216000,
      discountPercent: 10,
      bundleChoices: [{ name: "Americano" }, { name: "Nasi Daun Jeruk" }],
    },
  ],
  bills: { total: 252000, tax: 0, totalWithTax: 252000 },
  paymentMethod: "Cash",
};

const textLines = (entries) => entries.filter((entry) => entry.type === 0).map((entry) => entry.content);
const setDevicePixelRatio = (value) =>
  Object.defineProperty(window, "devicePixelRatio", { value, configurable: true });

describe("Thermer receipt", () => {
  beforeEach(() => {
    window.localStorage.clear();
    api.createThermalPrintUrl.mockReset();
    api.createThermalPrintUrl.mockResolvedValue({ data: { data: { url: "https://api.test/print/abc" } } });
  });

  it("sends the receipt as printer-font text, not HTML, so every device prints it the same size", async () => {
    const payloads = [];

    for (const ratio of [1, 1.5, 2.625]) {
      setDevicePixelRatio(ratio);
      await expect(printOrderReceipt(order)).resolves.toBe(true);
      payloads.push(api.createThermalPrintUrl.mock.calls.at(-1)[0].payload);
    }
    setDevicePixelRatio(1);

    expect(payloads[1]).toEqual(payloads[0]);
    expect(payloads[2]).toEqual(payloads[0]);
    expect(payloads[0].some((entry) => entry.type === 4)).toBe(false);
    // The paper picked on this device (none yet: 58).
    const { lineWidth } = getReceiptPaperSize();
    expect(payloads[0][0]).toEqual({
      type: 1,
      path: `${window.location.origin}/receipt-header-${getReceiptPaperWidth()}.png`,
      align: 0,
    });
    // NISKALA and COFFEE are in the logo image, centred to the dot.
    expect(payloads[0][1]).toMatchObject({
      type: 0,
      content: `${" ".repeat(Math.floor((lineWidth - 13) / 2))}Order Receipt`,
      align: 0,
    });
    textLines(payloads[0]).forEach((line) => expect(line.length).toBeLessThanOrEqual(lineWidth));
    expect(payloads[0].some((entry) => /NISKALA|COFFEE/.test(entry.content || ""))).toBe(false);
    // Centred with spaces, so a printer in 80 mm mode cannot push it off the paper.
    expect(payloads[0].every((entry) => entry.align === 0)).toBe(true);
  });

  it("prints for the paper picked on the device, 58 mm until one is picked", async () => {
    expect(getReceiptPaperWidth()).toBe(DEFAULT_RECEIPT_PAPER_WIDTH);
    expect(DEFAULT_RECEIPT_PAPER_WIDTH).toBe(58);

    expect(setReceiptPaperWidth(80)).toBe(true);
    expect(getReceiptPaperWidth()).toBe(80);
    await printOrderReceipt(order);
    const payload = api.createThermalPrintUrl.mock.calls.at(-1)[0].payload;
    expect(payload[0].path).toBe(`${window.location.origin}/receipt-header-80.png`);
    expect(textLines(payload)).toContain(`Qty: 2${" ".repeat(33)}Rp 36.000`);

    // Only 58 and 80 exist.
    expect(setReceiptPaperWidth(76)).toBe(false);
    window.localStorage.setItem("niskalaReceiptPaperWidth", "76");
    expect(getReceiptPaperWidth()).toBe(58);
  });

  it("fills the 32-character template from the order", () => {
    const lines = textLines(buildThermerReceiptEntries(order, { paperWidth: 58 }));

    // Without the logo image, the brand is printed as text.
    expect(buildThermerReceiptEntries(order, { paperWidth: 58 })[0]).toMatchObject({ content: "    NISKALA", bold: 1, format: 2 });

    lines.forEach((line) => expect(line.length).toBeLessThanOrEqual(32));
    expect(lines).toEqual(expect.arrayContaining([
      "Order ID : 2611-0007",
      "Customer : Meja 3",
      "Telepon  : 081234567890",
      "Date     : 12/11/26 10:00",
      "Payment  : Cash",
      "Kopi Susu",
      "Varian: Ice",
      "Qty: 2                 Rp 36.000",
      "Add-ons: Extra Shot",
      // Long names wrap per word.
      "Rice Bowl Ayam Black Pepper Saus",
      "Pedas",
      "Isi: Americano, Nasi Daun Jeruk",
      "Diskon 10%",
      "Qty: 12               Rp 216.000",
      "Subtotal              Rp 252.000",
      "Tax                         Rp 0",
      "         Order Receipt",
      "    Thank you for your order",
    ]));
    expect(buildThermerReceiptEntries(order, { paperWidth: 58 }).find((entry) => entry.content.startsWith("TOTAL")))
      .toMatchObject({ content: "TOTAL                 Rp 252.000", bold: 1 });
  });

  it("prints the same template from a laptop or PC, in millimetres from the left of the paper", async () => {
    isAndroidDevice.mockReturnValue(false);
    const printed = {
      closed: false,
      document: { open: vi.fn(), write: vi.fn(), close: vi.fn(), images: [] },
      focus: vi.fn(),
      print: vi.fn(),
      close: vi.fn(),
    };
    const open = vi.spyOn(window, "open").mockReturnValue(printed);

    try {
      await expect(printOrderReceipt(order)).resolves.toBe(true);
    } finally {
      open.mockRestore();
      isAndroidDevice.mockReturnValue(true);
    }

    const html = printed.document.write.mock.calls[0][0];
    const entries = buildThermerReceiptEntries(order);
    const lineOf = (start) => entries.find((entry) => entry.content?.startsWith(start)).content;
    expect(api.createThermalPrintUrl).not.toHaveBeenCalled();
    expect(html).toContain(`@page { size: ${getReceiptPaperWidth()}mm auto; margin: 0; }`);
    // Characters x 1.45 mm, no centring or shifting on the page.
    expect(html).toContain(`width: ${Number((getReceiptPaperSize().lineWidth * 1.45).toFixed(2))}mm;`);
    expect(html).not.toMatch(/translateX|margin: 0 auto/);
    expect(html).toContain(`src="${window.location.origin}/receipt-header-${getReceiptPaperWidth()}.png"`);
    expect(html).toContain(`<div class="line">${lineOf("Qty: 2")}</div>`);
    expect(html).toContain(`<div class="line bold">${lineOf("TOTAL")}</div>`);
    expect(html).toContain(`<div class="line bold">${"-".repeat(getReceiptPaperSize().lineWidth)}</div>`);
  });

  it("lays the receipt out 32 characters wide on 58 mm paper", () => {
    const printHtml = buildReceiptPrintHtml(order, { paperWidth: 58 });
    expect(printHtml).toContain("@page { size: 58mm auto; margin: 0; }");
    expect(printHtml).toContain("width: 46.4mm;");
    expect(printHtml).toContain('<div class="line">Qty: 2                 Rp 36.000</div>');
    expect(buildThermerReceiptEntries(order, { paperWidth: 58, logoBaseUrl: "https://pos.test" })[0])
      .toEqual({ type: 1, path: "https://pos.test/receipt-header-58.png", align: 0 });
  });

  it("lays the receipt out 48 characters wide on 80 mm paper", () => {
    const printHtml = buildReceiptPrintHtml(order, { paperWidth: 80 });
    expect(printHtml).toContain("@page { size: 80mm auto; margin: 0; }");
    expect(printHtml).toContain("width: 69.6mm;");

    const entries = buildThermerReceiptEntries(order, { paperWidth: 80, logoBaseUrl: "https://pos.test" });
    const lines = textLines(entries);

    lines.forEach((line) => expect(line.length).toBeLessThanOrEqual(48));
    expect(entries[0]).toEqual({ type: 1, path: "https://pos.test/receipt-header-80.png", align: 0 });
    expect(lines).toEqual(expect.arrayContaining([
      "-".repeat(48),
      "Customer : Meja 3",
      // The whole name fits on one 80 mm line.
      "Rice Bowl Ayam Black Pepper Saus Pedas",
      `Qty: 2${" ".repeat(33)}Rp 36.000`,
      `Subtotal${" ".repeat(30)}Rp 252.000`,
    ]));
  });

  it("shows the optional rows only when the order has them", () => {
    const plain = textLines(buildThermerReceiptEntries({ ...order, orderType: "Dine In" }, { paperWidth: 58 }));
    expect(plain.some((line) => /Telepon|Platform|Online|Biaya Platform|Instansi/.test(line))).toBe(false);

    const lines = textLines(buildThermerReceiptEntries({
      ...order,
      orderType: "Online",
      orderPlatform: "GoFood",
      platformTax: 12000,
      bills: { ...order.bills, onlineOrderCharge: 5000 },
      cateringDetails: { institution: "SMA 1", whatsapp: "0812", eventDate: "2026-11-20", deliveryTime: "10:00", isPaid: false },
      note: "Tidak pedas",
    }, { paperWidth: 58 }));

    expect(lines).toEqual(expect.arrayContaining([
      "Order ID     : 2611-0007",
      "Platform     : GoFood",
      "Status Bayar : Belum Lunas",
      "Online                  Rp 5.000",
      "Biaya Platform        -Rp 12.000",
      "      Catatan: Tidak pedas",
    ]));
    expect(lines).not.toContain("Thank you for your order");
  });

  it("keeps text the printer can print", () => {
    expect(toPrinterText("Café Latte – “Special” × 2")).toBe('Cafe Latte - "Special" x 2');
    expect(wrapText("A".repeat(40), 32)).toEqual(["A".repeat(32), "A".repeat(8)]);
  });
});
