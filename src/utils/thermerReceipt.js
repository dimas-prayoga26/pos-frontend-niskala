// Thermer receipt as plain text entries instead of HTML. The printer draws the
// text with its own font, so the receipt prints the same size on every device;
// an HTML entry is rendered on the device first and follows its resolution.
// Entry format (Thermer > Developer Help): type 0 text, type 1 image;
// align 0 left / 1 center / 2 right; format 0 normal / 2 double width + height.
// Everything is sent left-aligned and centred with spaces inside the line
// width: a printer left in 80 mm mode (or Thermer's paper size) would centre
// over 80 mm and push it off 58 mm paper.
import { bundleChoicesText } from "../features/pos/utils/bundleChoices";
import { formatJakartaReceiptDate, formatJakartaReceiptDateTime } from "../shared/lib/dates";
import { formatReceiptCurrency } from "../shared/lib/format";

// Paper in the receipt printer, 58 or 80 (mm), picked on each device under
// Kertas Struk on the POS page: the device's printer (and Thermer's Paper Size,
// 2 inch for 58 mm, 3 inch for 80 mm) is set per device too. Until a device
// picks one it prints for 58 mm, which still fits on 80 mm paper.
export const DEFAULT_RECEIPT_PAPER_WIDTH = 58;
const RECEIPT_PAPER_WIDTH_STORAGE_KEY = "niskalaReceiptPaperWidth";

export const getReceiptPaperWidth = () => {
  try {
    const stored = Number(window.localStorage.getItem(RECEIPT_PAPER_WIDTH_STORAGE_KEY));

    return RECEIPT_PAPER_SIZES[stored] ? stored : DEFAULT_RECEIPT_PAPER_WIDTH;
  } catch {
    return DEFAULT_RECEIPT_PAPER_WIDTH;
  }
};

export const setReceiptPaperWidth = (paperWidth) => {
  if (!RECEIPT_PAPER_SIZES[paperWidth]) return false;

  try {
    window.localStorage.setItem(RECEIPT_PAPER_WIDTH_STORAGE_KEY, String(paperWidth));
    return true;
  } catch {
    return false;
  }
};

// The printer font is 12 dots per character: 58 mm paper is 384 dots wide,
// 80 mm 576. Each logo (mark + NISKALA + COFFEE) is a black-and-white PNG as
// wide as its paper, so it prints the same whether Thermer prints it as is or
// scales it to the paper. Thermer keeps images it has downloaded: give a
// changed image a new file name.
export const RECEIPT_PAPER_SIZES = {
  58: { lineWidth: 32, logoPath: "/receipt-header-58.png" },
  80: { lineWidth: 48, logoPath: "/receipt-header-80.png" },
};

export const getReceiptPaperSize = (paperWidth = getReceiptPaperWidth()) =>
  RECEIPT_PAPER_SIZES[paperWidth] || RECEIPT_PAPER_SIZES[58];

const ALIGN_LEFT = 0;
const FORMAT_NORMAL = 0;
const FORMAT_DOUBLE = 2;

const TEMPERATURE_PATTERN = /^(cold|hot|ice|iced|dingin|panas)$/i;

// "Large / Ice" -> "Ice"
export const getVariantTemperature = (variant) =>
  String(variant ?? "")
    .split("/")
    .map((part) => part.trim())
    .find((part) => TEMPERATURE_PATTERN.test(part)) || "";

// The printer's code page is plain ASCII.
export const toPrinterText = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/⁄/g, "/")
    .replace(/×/g, "x")
    .replace(/\s+/g, " ")
    .replace(/[^\x20-\x7e]/g, "")
    .trim();

export const wrapText = (value, width = getReceiptPaperSize().lineWidth) => {
  const lines = [];
  let line = "";

  toPrinterText(value)
    .split(" ")
    .filter(Boolean)
    .forEach((word) => {
      let rest = word;

      // A word longer than a whole line is cut.
      while (rest.length > width) {
        if (line) lines.push(line);
        line = "";
        lines.push(rest.slice(0, width));
        rest = rest.slice(width);
      }

      if (!rest) return;

      if (!line) {
        line = rest;
      } else if (line.length + 1 + rest.length <= width) {
        line = `${line} ${rest}`;
      } else {
        lines.push(line);
        line = rest;
      }
    });

  if (line) lines.push(line);

  return lines;
};

// "Subtotal                Rp 36.000"
export const leftRight = (left, right, width = getReceiptPaperSize().lineWidth) => {
  const leftText = toPrinterText(left);
  const rightText = toPrinterText(right);
  const room = width - rightText.length - 1;

  if (leftText.length <= room) {
    return [`${leftText}${" ".repeat(width - leftText.length - rightText.length)}${rightText}`];
  }

  return [...wrapText(leftText, width), rightText.padStart(width)];
};

// "Customer : Meja 3", long values continue under the value column.
const labelValue = (label, value, labelWidth, width) => {
  const prefix = `${label.padEnd(labelWidth)}: `;
  const indent = " ".repeat(prefix.length);
  const lines = wrapText(toPrinterText(value) || "-", width - prefix.length);

  return lines.map((line, index) => `${index ? indent : prefix}${line}`);
};

const textEntry = (content, { bold = false, align = ALIGN_LEFT, format = FORMAT_NORMAL } = {}) => ({
  type: 0,
  content,
  bold: bold ? 1 : 0,
  align,
  format,
});

const textEntries = (lines, options) => lines.map((line) => textEntry(line, options));

// Double-size characters (and the spaces before them) are twice as wide.
export const centerLine = (text, width, characterScale = 1) =>
  `${" ".repeat(Math.max(0, Math.floor((width / characterScale - text.length) / 2)))}${text}`;

const getMetaRows = (orderInfo) => {
  const customer = orderInfo.customerDetails || {};
  const catering = orderInfo.cateringDetails;

  return [
    ["Order ID", orderInfo.orderId || orderInfo.orderCode || orderInfo.id],
    ["Customer", customer.name],
    orderInfo.orderType === "Offline" && customer.phone ? ["Telepon", customer.phone] : null,
    ["Date", formatJakartaReceiptDateTime(orderInfo.orderDate || orderInfo.createdAt || undefined)],
    ["Payment", orderInfo.paymentMethod],
    orderInfo.orderType === "Online" ? ["Platform", orderInfo.orderPlatform] : null,
    ...(catering
      ? [
          ["Instansi", catering.institution],
          ["WhatsApp", catering.whatsapp],
          ["Tgl Acara", formatJakartaReceiptDate(catering.eventDate)],
          ["Jam Kirim", catering.deliveryTime],
          ["Status Bayar", catering.isPaid ? "Lunas" : "Belum Lunas"],
        ]
      : []),
  ].filter(Boolean);
};

const getItemLines = (item, width) => {
  const temperature = getVariantTemperature(item.variant);
  const discountPercent = Number(item.discountPercent) || 0;

  return [
    ...wrapText(item.name, width),
    ...(temperature ? wrapText(`Varian: ${temperature}`, width) : []),
    ...(item.bundleChoices?.length ? wrapText(`Isi: ${bundleChoicesText(item.bundleChoices)}`, width) : []),
    // Bahan olahan swapped (Nasi Daun Jeruk for Nasi Putih).
    ...(item.ingredientSwaps || []).flatMap((swap) => wrapText(`Pilihan: ${swap.toName}`, width)),
    ...(discountPercent > 0 ? [`Diskon ${discountPercent}%`] : []),
    ...leftRight(`Qty: ${item.quantity}`, formatReceiptCurrency(item.price), width),
    ...(item.addOns?.length
      ? wrapText(`Add-ons: ${item.addOns.map((addOn) => addOn.name).join(", ")}`, width)
      : []),
  ];
};

// logoBaseUrl: where the logo PNG is served (the POS origin); no logo without it.
export const buildThermerReceiptEntries = (
  orderInfo,
  { logoBaseUrl, paperWidth = getReceiptPaperWidth() } = {}
) => {
  const { lineWidth: width, logoPath } = getReceiptPaperSize(paperWidth);
  const bills = orderInfo.bills || {};
  const onlineOrderCharge = Number(bills.onlineOrderCharge) || 0;
  const platformFee = Number(orderInfo.platformTax) || 0;
  const note = orderInfo.note || orderInfo.cateringDetails?.note;
  const metaRows = getMetaRows(orderInfo);
  const labelWidth = Math.max(...metaRows.map(([label]) => label.length)) + 1;
  // Bold, so the dashes do not print faint.
  const separator = textEntry("-".repeat(width), { bold: true });
  const amountLines = (left, right) => leftRight(left, right, width);

  return [
    // The PNG is as wide as the paper with the logo, NISKALA and COFFEE centred
    // to the dot: double-size text can only be centred to half a character.
    ...(logoBaseUrl
      ? [{ type: 1, path: new URL(logoPath, logoBaseUrl).href, align: ALIGN_LEFT }]
      : [
          textEntry(centerLine("NISKALA", width, 2), { bold: true, format: FORMAT_DOUBLE }),
          textEntry(centerLine("COFFEE", width)),
        ]),
    textEntry(centerLine("Order Receipt", width)),
    separator,
    ...metaRows.flatMap(([label, value]) => textEntries(labelValue(label, value, labelWidth, width))),
    separator,
    ...(orderInfo.items || []).flatMap((item) => [...textEntries(getItemLines(item, width)), separator]),
    ...textEntries([
      ...amountLines("Subtotal", formatReceiptCurrency(bills.total)),
      ...(onlineOrderCharge > 0 ? amountLines("Online", formatReceiptCurrency(onlineOrderCharge)) : []),
      ...amountLines("Tax", formatReceiptCurrency(bills.tax)),
      ...(platformFee > 0 ? amountLines("Biaya Platform", `-${formatReceiptCurrency(platformFee)}`) : []),
    ]),
    separator,
    ...textEntries(amountLines("TOTAL", formatReceiptCurrency(bills.totalWithTax)), { bold: true }),
    separator,
    ...textEntries(
      (note ? wrapText(`Catatan: ${note}`, width) : ["Thank you for your order"]).map((line) =>
        centerLine(line, width)
      )
    ),
    // Feed the paper past the cutter.
    textEntry(" "),
    textEntry(" "),
  ];
};

// The same receipt for a laptop or PC, printed from Chrome's print dialog: the
// lines above in a fixed-width font sized in millimetres (32 characters fill
// the 48 mm a 58 mm printer prints on), anchored to the left of the printable
// area, so it does not depend on the screen or the driver's page width.
const PRINT_CHARACTER_WIDTH_MM = 1.45;
// Courier New characters are 0.6 em wide.
const PRINT_FONT_SIZE_MM = Number((PRINT_CHARACTER_WIDTH_MM / 0.6).toFixed(2));

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export const buildReceiptPrintHtml = (
  orderInfo,
  { logoBaseUrl, paperWidth = getReceiptPaperWidth() } = {}
) => {
  const { lineWidth } = getReceiptPaperSize(paperWidth);
  const lines = buildThermerReceiptEntries(orderInfo, { logoBaseUrl, paperWidth })
    .map((entry) => {
      if (entry.type === 1) {
        return `<img class="logo" src="${escapeHtml(entry.path)}" alt="" />`;
      }

      const classes = [
        "line",
        entry.bold && "bold",
        entry.format === FORMAT_DOUBLE && "double",
      ].filter(Boolean);

      return `<div class="${classes.join(" ")}">${escapeHtml(entry.content)}</div>`;
    })
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Order Receipt</title>
    <style>
      @page { size: ${paperWidth}mm auto; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; color: #000; }
      .receipt {
        width: ${Number((lineWidth * PRINT_CHARACTER_WIDTH_MM).toFixed(2))}mm;
        padding-top: 2mm;
        font-family: "Courier New", Courier, monospace;
        font-size: ${PRINT_FONT_SIZE_MM}mm;
        font-weight: 700;
        line-height: 1.3;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .line { white-space: pre; overflow: hidden; }
      .bold { font-weight: 900; }
      .double { font-size: ${PRINT_FONT_SIZE_MM * 2}mm; line-height: 1.2; }
      .logo { display: block; width: 100%; height: auto; }
    </style>
  </head>
  <body><div class="receipt">${lines}</div></body>
</html>`;
};
