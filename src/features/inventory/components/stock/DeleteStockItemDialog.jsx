const DeleteStockItemDialog = ({ item, onConfirm, onCancel, isDeleting }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
    <div
      className="rounded-lg bg-[#262626] p-5 text-[#f5f5f5] shadow-2xl"
      style={{ width: "min(92vw, 380px)" }}
    >
      <h3 className="text-lg font-bold">Hapus bahan?</h3>
      <p className="mt-2 text-sm text-[#ababab]">
        Bahan <span className="font-semibold text-[#f5f5f5]">{item.name}</span> akan dihapus dari
        daftar stok.
      </p>
      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg bg-[#333] px-4 py-2 text-sm font-semibold text-[#f5f5f5]"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isDeleting}
          className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isDeleting ? "Menghapus..." : "Hapus"}
        </button>
      </div>
    </div>
  </div>
);

export default DeleteStockItemDialog;
