// RawBT accepts ESC/POS bytes through its documented Android intent URI.
// https://github.com/mike42/escpos-php/blob/development/src/Mike42/Escpos/PrintConnectors/RawbtPrintConnector.php
export const usesRawbt = () => import.meta.env.VITE_ANDROID_PRINT_APP === "rawbt";

export const rasterToEscPos = (pixels, width, height) => {
  if (width !== 384 || !Number.isInteger(height) || height < 1 || height > 12000 || pixels.length !== width * height * 4) {
    throw new Error("Ukuran gambar struk tidak valid.");
  }
  const output = [27, 64, 27, 97, 0];
  for (let top = 0; top < height; top += 128) {
    const rows = Math.min(128, height - top);
    output.push(29, 118, 48, 0, width / 8, 0, rows, 0);
    for (let y = top; y < top + rows; y++) {
      for (let x = 0; x < width; x += 8) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const i = ((y * width) + x + bit) * 4;
          const alpha = pixels[i + 3] / 255;
          const gray = (pixels[i] * 299 + pixels[i + 1] * 587 + pixels[i + 2] * 114) / 1000;
          if (gray * alpha + 255 * (1 - alpha) < 180) byte |= 128 >> bit;
        }
        output.push(byte);
      }
    }
  }
  output.push(27, 100, 4);
  return new Uint8Array(output);
};

export const rawbtReceiptStyle = `
  * { box-sizing: border-box; }
  body { margin:0; width:384px; background:white; color:black; font:18px/1.25 Arial,sans-serif; }
  .receipt { width:384px; padding:8px; overflow-wrap:anywhere; }
  .brand,.receipt-title,.footer { text-align:center; }
  .logo-mark { display:block; width:64px; height:64px; margin:0 auto 4px; }
  .brand-name { font:bold 32px Georgia,serif; }
  .brand-subtitle,.footer { font-size:16px; }
  .receipt-title { font-weight:bold; margin:8px 0; }
  .receipt-separator { border-top:1px dashed black; margin:10px 0; }
  .meta-row { display:grid; grid-template-columns:100px minmax(0,1fr); gap:10px; margin:4px 0; }
  .meta-row strong::before { content:': '; }
  .meta-row strong { font-weight:normal; }
  .item-main { font-size:20px; font-weight:bold; margin:6px 0; }
  .line-note { font-size:16px; }
  .item-detail,.total-block { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:4px 0; }
  .item-detail strong,.total-block strong { text-align:right; }
  .grand { font-size:23px; font-weight:bold; }
  .footer { margin:10px 0; }
`;

export const createRawbtReceiptIntent = async (receiptHtml, {
  style = rawbtReceiptStyle,
  sourceWidth = 384,
} = {}) => {
  // Preserve the profile's CSS layout, then fit its full bounds to printer dots.
  // Advan's content is wider than its 219px page; capture the overflow too.
  const renderStyle = `${style}\nhtml,body,.bluetooth-print-page { overflow:visible !important; }`;
  const frame = document.createElement("iframe");
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${sourceWidth}px;height:1px;border:0;visibility:hidden`;
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!doctype html><html><head><style>${renderStyle}</style></head><body>${receiptHtml}</body></html>`);
    doc.close();
    await Promise.all(Array.from(doc.images, image => image.decode()));
    await doc.fonts.ready;
    const bounds = Array.from(doc.querySelectorAll(".receipt, .receipt *"), element => element.getBoundingClientRect());
    const left = Math.floor(Math.min(0, ...bounds.map(rect => rect.left)));
    const top = Math.floor(Math.min(0, ...bounds.map(rect => rect.top)));
    const captureWidth = Math.ceil(Math.max(sourceWidth, ...bounds.map(rect => rect.right))) - left;
    const captureHeight = Math.ceil(Math.max(...bounds.map(rect => rect.bottom))) - top;
    const height = Math.ceil(captureHeight * 384 / captureWidth);
    if (height < 1 || height > 12000) throw new Error("Struk terlalu panjang. Kurangi jumlah item untuk dicetak.");
    const body = new XMLSerializer().serializeToString(doc.body);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="384" height="${height}" viewBox="${left} ${top} ${captureWidth} ${captureHeight}"><foreignObject width="${captureWidth}" height="${captureHeight}" style="overflow:visible"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${sourceWidth}px"><style>${renderStyle}</style>${body}</div></foreignObject></svg>`;
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 384;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0, 0, 384, height);
    context.drawImage(image, 0, 0);
    const bytes = rasterToEscPos(context.getImageData(0, 0, 384, height).data, 384, height);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return `intent:base64,${btoa(binary)}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
  } finally { frame.remove(); }
};
