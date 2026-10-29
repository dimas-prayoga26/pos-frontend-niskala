// Bukti nota photos. Phone cameras produce 3-8 MB pictures; they are shrunk
// to a JPEG of at most 1600 px before upload, which keeps the text readable.
export const MAX_RECEIPTS_PER_UPLOAD = 5;
export const MAX_RECEIPTS_PER_PURCHASE = 10;
const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.8;

let receiptKey = 0;

const DECODE_TIMEOUT_MS = 15000;

const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    const finish = (error) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      if (error) reject(error);
      else resolve(image);
    };
    // Some browsers never fire load or error for formats they cannot decode.
    const timer = setTimeout(() => finish(new Error("Foto tidak bisa dibaca.")), DECODE_TIMEOUT_MS);
    image.onload = () => finish();
    image.onerror = () => finish(new Error("Foto tidak bisa dibaca."));
    image.src = url;
  });

// Returns the original file when the browser cannot decode it (the server
// then accepts or rejects it) or when shrinking would not make it smaller.
export const compressReceiptImage = async (file) => {
  try {
    const image = await loadImage(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    // JPEG has no transparency: paint a white background for PNG screenshots.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));

    if (!blob || blob.size >= file.size) return file;

    const baseName = String(file.name || "bukti-nota").replace(/\.[^.]+$/, "") || "bukti-nota";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
};

// { key, file, previewUrl } for the form; revokeReceipt frees the preview.
export const createReceipt = (file) => ({
  key: ++receiptKey,
  file,
  previewUrl: URL.createObjectURL(file),
});

export const revokeReceipt = (receipt) => URL.revokeObjectURL(receipt.previewUrl);

export const isImageFile = (file) => String(file?.type || "").startsWith("image/");

// Phones and tablets open their camera app for <input capture>; desktop
// browsers ignore the attribute and show the file chooser instead.
export const supportsNativeCapture = () =>
  typeof HTMLInputElement !== "undefined" && "capture" in HTMLInputElement.prototype;

// A webcam preview needs getUserMedia, which browsers only allow on https or
// localhost (not on http://192.168.x.x).
export const supportsLiveCamera = () =>
  typeof window !== "undefined" &&
  Boolean(window.isSecureContext && navigator.mediaDevices?.getUserMedia);

export const cameraErrorMessage = (error) => {
  switch (error?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Izin kamera ditolak. Izinkan kamera di pengaturan browser, atau pakai Pilih dari Galeri.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Kamera tidak ditemukan di perangkat ini. Pakai Pilih dari Galeri.";
    case "NotReadableError":
      return "Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu lalu coba lagi.";
    default:
      return "Kamera tidak bisa dibuka. Pakai Pilih dari Galeri.";
  }
};
