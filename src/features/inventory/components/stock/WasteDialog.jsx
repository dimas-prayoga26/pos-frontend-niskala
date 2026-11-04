import { useEffect, useRef, useState } from "react";
import { enqueueSnackbar } from "notistack";
import { currency, quantityDisplay } from "../../utils/format";
import { getWasteCost } from "../../utils/preparedItems";
import {
  MAX_RECEIPTS_PER_UPLOAD,
  compressReceiptImage,
  createReceipt,
  isImageFile,
  revokeReceipt,
} from "../../utils/receiptImages";
import { parseCostInput } from "../../utils/stockItems";
import ReceiptPicker from "../shopping/ReceiptPicker";

const inputClass =
  "w-full rounded-lg border border-[#555] bg-[#1f1f1f] px-3 py-2 text-[#f5f5f5] outline-none focus:border-[#d6c7ae]";

// Reasons staff pick (Modul 3); "Sisa akhir hari" is written by the daily
// recap and "Penyesuaian" by a stock count.
const WASTE_REASONS = ["Basi", "Jatuh", "Gosong", "Expired", "Lainnya"];

// Buang: bahan baku or bahan olahan thrown away. They leave the stock
// and are kept as kerugian at the current cost. Kasir must add a bukti foto
// (camera or gallery, shrunk like bukti nota); for admins it is optional.
const WasteDialog = ({ item, isAdmin, onSave, onCancel, isSaving }) => {
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState(WASTE_REASONS[0]);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState([]);
  const [preparing, setPreparing] = useState(false);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  useEffect(() => () => photosRef.current.forEach(revokeReceipt), []);

  const amount = parseCostInput(quantity);
  const available = Math.max(Number(item.stock || 0), 0);
  const isValid =
    Number.isFinite(amount) && amount > 0 && amount <= available && (isAdmin || photos.length > 0);

  const addPhotos = async (files) => {
    const images = files.filter(isImageFile).slice(0, Math.max(MAX_RECEIPTS_PER_UPLOAD - photosRef.current.length, 0));
    if (images.length < files.length) {
      enqueueSnackbar(`Hanya foto yang dipakai, maksimal ${MAX_RECEIPTS_PER_UPLOAD} foto.`, { variant: "warning" });
    }
    if (!images.length) return;

    setPreparing(true);
    try {
      const prepared = await Promise.all(images.map(compressReceiptImage));
      setPhotos((current) => [...current, ...prepared.map(createReceipt)]);
    } finally {
      setPreparing(false);
    }
  };

  const removePhoto = (key) => {
    photosRef.current.filter((photo) => photo.key === key).forEach(revokeReceipt);
    setPhotos((current) => current.filter((photo) => photo.key !== key));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!isValid || preparing) return;

    onSave({ quantity: amount, reason, note: note.trim(), files: photos.map((photo) => photo.file) });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={handleSubmit}
        aria-label="Form buang"
        className="max-h-[92vh] overflow-y-auto rounded-lg bg-[#262626] p-5 text-[#f5f5f5] shadow-2xl"
        style={{ width: "min(92vw, 440px)" }}
      >
        <h3 className="text-lg font-bold">Buang {item.name}</h3>
        <p className="mt-1 text-sm text-[#ababab]">Sisa stok: {quantityDisplay(available, item.unit)}</p>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-semibold">Jumlah dibuang ({item.unit})</span>
          <input
            type="text"
            inputMode="decimal"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className={inputClass}
            placeholder="Contoh: 5"
          />
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-semibold">Alasan</span>
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            aria-label="Alasan"
            className={inputClass}
          >
            {WASTE_REASONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-semibold">Catatan</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className={inputClass}
            placeholder="Opsional"
          />
        </label>
        <div className="mt-3">
          <span className="mb-1 block text-sm font-semibold">
            Foto bukti{" "}
            {isAdmin ? (
              <span className="font-normal text-[#ababab]">(opsional)</span>
            ) : (
              <span className="text-red-400">(wajib)</span>
            )}
          </span>
          <ReceiptPicker
            receipts={photos}
            onAdd={addPhotos}
            onRemove={removePhoto}
            max={MAX_RECEIPTS_PER_UPLOAD}
            disabled={isSaving}
            busy={preparing}
            subject="bukti buang"
          />
        </div>

        <div className="mt-4 flex items-center justify-between rounded-lg bg-[#1f1f1f] p-3 text-sm">
          <span className="text-[#ababab]">Kerugian</span>
          <strong className="text-red-400">{currency(getWasteCost(item, quantity))}</strong>
        </div>
        {Number.isFinite(amount) && amount > available && (
          <p className="mt-2 text-xs text-red-400">
            Lebih dari sisa stok ({quantityDisplay(available, item.unit)}).
          </p>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-[#333] px-4 py-2 text-sm font-semibold text-[#f5f5f5]"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={!isValid || isSaving || preparing}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Menyimpan..." : "Buang"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default WasteDialog;
