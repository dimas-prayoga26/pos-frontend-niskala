import { useCallback, useRef, useState } from "react";
import { FiCamera, FiImage, FiX } from "react-icons/fi";
import { supportsLiveCamera, supportsNativeCapture } from "../../utils/receiptImages";
import CameraCaptureDialog from "./CameraCaptureDialog";

const pickerClass =
  "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#a79981] px-4 py-2 text-sm font-semibold text-[#d6c7ae] transition-colors hover:bg-[#a79981]/10 focus-within:ring-2 focus-within:ring-[#d6c7ae] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6c7ae]";
const disabledPickerClass =
  "inline-flex min-h-10 cursor-not-allowed items-center gap-2 rounded-lg border border-[#444] px-4 py-2 text-sm font-semibold text-[#777]";

// Two ways to add bukti nota photos:
// - "Ambil Foto" opens the camera. Phones and tablets get their own camera
//   app (<input capture="environment">, back camera); computers get a webcam
//   preview (CameraCaptureDialog), because desktop browsers ignore capture.
//   Without a usable camera API it falls back to the file chooser.
// - "Pilih dari Galeri" picks saved pictures.
const ReceiptPicker = ({ receipts = [], onAdd, onRemove, max, disabled = false, busy = false, hint }) => {
  const cameraInput = useRef(null);
  const [showCamera, setShowCamera] = useState(false);
  const full = receipts.length >= max;
  const blocked = disabled || busy || full;
  const closeCamera = useCallback(() => setShowCamera(false), []);

  const handleChange = (event) => {
    const files = Array.from(event.target.files || []);
    // Reset so picking the same photo again still fires a change.
    event.target.value = "";
    if (files.length) onAdd(files);
  };

  const openCamera = () => {
    if (!supportsNativeCapture() && supportsLiveCamera()) {
      setShowCamera(true);
      return;
    }
    cameraInput.current?.click();
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={blocked}
          onClick={openCamera}
          className={blocked ? disabledPickerClass : pickerClass}
        >
          <FiCamera size={16} aria-hidden="true" />
          Ambil Foto
        </button>
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          disabled={blocked}
          onChange={handleChange}
          aria-label="Ambil foto bukti nota"
        />
        <label className={blocked ? disabledPickerClass : pickerClass}>
          <FiImage size={16} aria-hidden="true" />
          Pilih dari Galeri
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={blocked}
            onChange={handleChange}
            aria-label="Pilih bukti nota dari galeri"
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-[#ababab]">
        {busy ? "Menyiapkan foto..." : hint || `${receipts.length} / ${max} foto. JPG, PNG, atau WEBP.`}
      </p>
      {receipts.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-3" aria-label="Foto bukti nota">
          {receipts.map((receipt, index) => (
            <li key={receipt.key} className="relative">
              <img
                src={receipt.previewUrl}
                alt={`Bukti nota ${index + 1}`}
                className="h-24 w-24 rounded-lg border border-[#444] object-cover"
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRemove(receipt.key)}
                aria-label={`Hapus foto bukti ${index + 1}`}
                className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow disabled:opacity-50"
              >
                <FiX size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {showCamera && <CameraCaptureDialog onCapture={(file) => onAdd([file])} onClose={closeCamera} />}
    </div>
  );
};

export default ReceiptPicker;
