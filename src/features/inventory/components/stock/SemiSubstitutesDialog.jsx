/* eslint-disable react/prop-types */
import { useState } from "react";
import { formatRupiahInput } from "../../utils/format";

const inputClass =
  "w-full rounded-lg border border-[#555] bg-[#1f1f1f] px-3 py-2 text-[#f5f5f5] outline-none focus:border-[#d6c7ae]";

// Pengganti of a bahan olahan: others a menu using it may be sold with
// instead (Nasi Daun Jeruk for Nasi Putih), each with an extra price. Every
// menu with this bahan olahan offers them at the kasir.
const SemiSubstitutesDialog = ({ item, semiItems, onSave, onCancel, isSaving }) => {
  const itemId = Number(item.id || item._id);
  const candidates = semiItems.filter((semiItem) => Number(semiItem.id || semiItem._id) !== itemId);
  const [rows, setRows] = useState(() =>
    (item.substitutes || []).map((substitute) => ({
      semiItemId: String(substitute.semiItemId),
      extraPrice: String(substitute.extraPrice || ""),
    }))
  );

  const setRow = (index, field, value) =>
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
  const usedIds = (exceptIndex) =>
    new Set(rows.filter((_, index) => index !== exceptIndex).map((row) => row.semiItemId));

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave(
      rows
        .filter((row) => row.semiItemId)
        .map((row) => ({ semiItemId: Number(row.semiItemId), extraPrice: Number(row.extraPrice || 0) }))
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={handleSubmit}
        aria-label={`Pengganti ${item.name}`}
        className="rounded-lg bg-[#262626] p-5 text-[#f5f5f5] shadow-2xl"
        style={{ width: "min(92vw, 480px)" }}
      >
        <div className="mb-4 border-b border-[#333] pb-3">
          <h3 className="text-lg font-bold">Pengganti {item.name}</h3>
        </div>

        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={index} className="grid grid-cols-[1fr_140px_auto] items-end gap-2">
              <label>
                <span className="mb-1 block text-sm font-semibold">Bahan olahan</span>
                <select
                  value={row.semiItemId}
                  onChange={(event) => setRow(index, "semiItemId", event.target.value)}
                  aria-label={`Pengganti ${index + 1}`}
                  className={inputClass}
                >
                  <option value="">Pilih bahan olahan</option>
                  {candidates
                    .filter((candidate) => !usedIds(index).has(String(candidate.id || candidate._id)))
                    .map((candidate) => (
                      <option key={candidate.id || candidate._id} value={candidate.id || candidate._id}>
                        {candidate.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-sm font-semibold">Tambahan harga</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatRupiahInput(row.extraPrice)}
                  onChange={(event) => setRow(index, "extraPrice", event.target.value.replace(/\D/g, ""))}
                  aria-label={`Tambahan harga ${index + 1}`}
                  className={inputClass}
                  placeholder="0"
                />
              </label>
              <button
                type="button"
                onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                aria-label={`Hapus pengganti ${index + 1}`}
                className="rounded-lg px-2 py-2 text-sm font-semibold text-red-400 hover:text-red-300"
              >
                Hapus
              </button>
            </div>
          ))}
          {rows.length === 0 && <p className="text-sm text-[#ababab]">Belum ada pengganti.</p>}
        </div>

        <button
          type="button"
          onClick={() => setRows((current) => [...current, { semiItemId: "", extraPrice: "" }])}
          disabled={rows.length >= candidates.length}
          className="mt-3 text-sm font-semibold text-[#d6c7ae] hover:text-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-40"
        >
          + Tambah Pengganti
        </button>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5]"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010] disabled:opacity-60"
          >
            {isSaving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SemiSubstitutesDialog;
