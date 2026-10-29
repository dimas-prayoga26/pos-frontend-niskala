import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { FiTrash2 } from "react-icons/fi";
import { backendBaseUrl } from "../../../../shared/api/backendUrl";
import { PURCHASE_KINDS } from "../../utils/purchaseKinds";
import {
  MAX_RECEIPTS_PER_PURCHASE,
  MAX_RECEIPTS_PER_UPLOAD,
  compressReceiptImage,
  isImageFile,
} from "../../utils/receiptImages";
import ReceiptPicker from "./ReceiptPicker";

// Bukti nota of one purchase. Photos are served by the API to logged-in
// users only; isAdmin (also given for drafts, which every staff member may
// change) lets the user add more (camera or gallery) or delete one.
const PurchaseReceiptsDialog = ({ purchaseId, attachments = [], isAdmin, onClose, kind = PURCHASE_KINDS.raw }) => {
  const queryClient = useQueryClient();
  const [preparing, setPreparing] = useState(false);
  const room = Math.min(MAX_RECEIPTS_PER_UPLOAD, MAX_RECEIPTS_PER_PURCHASE - attachments.length);

  // Escape closes only this dialog, not the purchase history dialog under it,
  // and leaves it open while the webcam dialog on top handles the key.
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== "Escape" || document.querySelector("[data-camera-capture]")) return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose]);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [kind.historyKey] }),
      queryClient.invalidateQueries({ queryKey: ["purchase-drafts"] }),
    ]);
  const uploadMutation = useMutation({
    mutationFn: (data) => kind.uploadAttachments(data),
    onSuccess: async () => {
      enqueueSnackbar("Bukti nota tersimpan.", { variant: "success" });
      await refresh();
    },
    onError: (error) =>
      enqueueSnackbar(error?.response?.data?.message || "Gagal mengunggah bukti nota.", { variant: "error" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => kind.deleteAttachment(id),
    onSuccess: async () => {
      enqueueSnackbar("Bukti nota dihapus.", { variant: "success" });
      await refresh();
    },
    onError: (error) =>
      enqueueSnackbar(error?.response?.data?.message || "Gagal menghapus bukti nota.", { variant: "error" }),
  });

  const addFiles = async (files) => {
    const images = files.filter(isImageFile).slice(0, Math.max(room, 0));
    if (images.length < files.length) {
      enqueueSnackbar(`Hanya foto yang dipakai, maksimal ${MAX_RECEIPTS_PER_PURCHASE} foto per belanja.`, {
        variant: "warning",
      });
    }
    if (!images.length) return;

    setPreparing(true);
    try {
      const prepared = await Promise.all(images.map(compressReceiptImage));
      uploadMutation.mutate({ purchaseId, files: prepared });
    } finally {
      setPreparing(false);
    }
  };

  const removeAttachment = (attachment, index) => {
    if (!window.confirm(`Hapus bukti nota ${index + 1} dari belanja #${purchaseId}?`)) return;
    deleteMutation.mutate(attachment.id);
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="purchase-receipts-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-[#1f1f1f] p-5 text-[#f5f5f5] shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#333] pb-4">
          <div>
            <h2 id="purchase-receipts-title" className="text-xl font-bold">
              Bukti Nota #{purchaseId}
            </h2>
            <p className="mt-1 text-sm text-[#ababab]">
              {attachments.length} foto. Klik foto untuk membuka ukuran penuh.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5]"
          >
            Tutup
          </button>
        </div>

        {attachments.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Daftar bukti nota">
            {attachments.map((attachment, index) => (
              <li key={attachment.id} className="rounded-lg border border-[#444] bg-[#262626] p-2">
                <a href={`${backendBaseUrl}${attachment.url}`} target="_blank" rel="noreferrer">
                  <img
                    src={`${backendBaseUrl}${attachment.url}`}
                    alt={`Bukti nota ${index + 1} belanja #${purchaseId}`}
                    loading="lazy"
                    className="aspect-[3/4] w-full rounded-md bg-[#181818] object-cover"
                  />
                </a>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-[#ababab]">
                  <span className="truncate" title={attachment.name}>
                    {attachment.name || `Foto ${index + 1}`}
                  </span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment, index)}
                      disabled={deleteMutation.isPending}
                      aria-label={`Hapus bukti nota ${index + 1}`}
                      className="shrink-0 rounded-md p-1.5 text-red-300 hover:bg-red-400/10 disabled:opacity-50"
                    >
                      <FiTrash2 size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-[#262626] p-5 text-center text-sm text-[#ababab]">
            Belum ada bukti nota untuk belanja ini.
          </p>
        )}

        {isAdmin && (
          <div className="mt-5 border-t border-[#333] pt-4">
            <span className="mb-2 block text-sm font-semibold">Tambah Bukti Nota</span>
            <ReceiptPicker
              receipts={[]}
              onAdd={addFiles}
              onRemove={() => {}}
              max={Math.max(room, 0)}
              busy={preparing || uploadMutation.isPending}
              hint={
                room > 0
                  ? `Bisa tambah ${room} foto lagi. JPG, PNG, atau WEBP.`
                  : `Sudah ${MAX_RECEIPTS_PER_PURCHASE} foto, hapus satu untuk menambah.`
              }
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PurchaseReceiptsDialog;
