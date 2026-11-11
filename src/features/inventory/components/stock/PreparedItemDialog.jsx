import { useMemo, useState } from "react";
import { enqueueSnackbar } from "notistack";
import CreatableSelect2 from "../../../../shared/ui/CreatableSelect2";
import { toPreparedPayload } from "../../utils/preparedItems";
import { isRecipeIngredient } from "../../utils/stockItems";

const inputClass =
  "w-full min-w-0 rounded-lg border border-[#555] bg-[#1f1f1f] px-3 py-2 text-[#f5f5f5] outline-none focus:border-[#d6c7ae]";
const sectionClass = "mb-3 rounded-lg border border-[#333] bg-[#202020] p-3";

const LEFTOVER_OPTIONS = [
  {
    resetDaily: true,
    label: "Dibuang tiap hari",
    description: "Stok jadi 0 tiap pukul 00.00, sisanya dicatat kerugian. Contoh: Nasi.",
  },
  {
    resetDaily: false,
    label: "Disimpan untuk besok",
    description: "Sisa tetap jadi stok besok. Contoh: Sambal.",
  },
];

const emptyComponent = () => ({ stockItemId: "" });

const toForm = (item) => ({
  name: item?.name || "",
  resetDaily: item ? Boolean(item.resetDaily) : true,
  components: item?.components?.length
    ? item.components.map((component) => ({ stockItemId: String(component.stockItemId) }))
    : [emptyComponent()],
});

const SectionTitle = ({ children }) => <h4 className="mb-2 text-sm font-semibold">{children}</h4>;

// Bahan baku search: the first 5 matches.
const MAX_BAHAN_RESULTS = 5;
const rawItemId = (rawItem) => String(rawItem.id || rawItem._id);

// Adds or edits a bahan olahan: its name, the bahan baku it is cooked
// from and what happens to the leftover each day. How much of each bahan and
// how many portions come out are filled at Catat Masak. A bahan baku the
// search does not find can be made first: onCreateRawItem(name, form, row)
// leaves with the form, which comes back as initialForm. initialName fills
// the name of a new one.
const PreparedItemDialog = ({
  item,
  initialForm,
  initialName = "",
  rawItems,
  onSave,
  onCancel,
  onCreateRawItem,
  isSaving,
}) => {
  const [form, setForm] = useState(() => initialForm || { ...toForm(item), ...(!item && { name: initialName }) });
  const recipeOptions = rawItems.filter(isRecipeIngredient);
  // Per row: the bahan resep not picked in another row (a bahan is picked
  // once), plus the row's own bahan.
  const componentIds = form.components.map((component) => component.stockItemId).join("|");
  const optionsByRow = useMemo(() => {
    const ids = componentIds.split("|");
    return ids.map((ownId, index) => {
      const takenIds = new Set(ids.filter((_, otherIndex) => otherIndex !== index));
      return [
        { id: "", text: "Pilih bahan baku" },
        ...rawItems
          .filter((rawItem) => {
            const id = rawItemId(rawItem);
            return id === ownId || (isRecipeIngredient(rawItem) && !takenIds.has(id));
          })
          .map((rawItem) => ({ id: rawItemId(rawItem), text: rawItem.name })),
      ];
    });
  }, [rawItems, componentIds]);
  // What the search of a row did not find: a bahan picked in another row or
  // not a Bahan Resep, or a bahan baku that does not exist yet.
  const notFoundFor = (index) => (term) => {
    const key = term.toLowerCase();
    const existing = key && rawItems.find((rawItem) => String(rawItem.name).trim().toLowerCase() === key);
    if (existing && !isRecipeIngredient(existing)) {
      return { message: `${existing.name} bukan Bahan Resep. Aktifkan di tab Bahan Baku.` };
    }
    if (existing) return { message: `${existing.name} sudah dipilih.` };
    return {
      message: key ? `Bahan baku "${term}" tidak ada.` : "Belum ada bahan baku.",
      action: onCreateRawItem && "Buat Bahan Baku",
      onAction: onCreateRawItem && (() => onCreateRawItem(term, form, index)),
    };
  };
  const setComponent = (index, stockItemId) =>
    setForm((current) => ({
      ...current,
      components: current.components.map((component, componentIndex) =>
        componentIndex === index ? { stockItemId } : component
      ),
    }));

  const handleSubmit = (event) => {
    event.preventDefault();

    const payload = toPreparedPayload(form);
    if (!payload.name) {
      enqueueSnackbar("Nama bahan olahan wajib diisi.", { variant: "error" });
      return;
    }
    if (!payload.components.length) {
      enqueueSnackbar("Pilih minimal satu bahan baku.", { variant: "error" });
      return;
    }

    onSave({ id: item?.id || item?._id, ...payload });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={handleSubmit}
        aria-label="Form bahan olahan"
        className="max-h-[92vh] overflow-y-auto rounded-lg bg-[#262626] p-5 text-[#f5f5f5] shadow-2xl"
        style={{ width: "min(94vw, 620px)" }}
      >
        <h3 className="mb-4 text-lg font-bold">{item ? "Ubah Bahan Olahan" : "Tambah Bahan Olahan"}</h3>

        <div className={sectionClass}>
          <SectionTitle>Nama</SectionTitle>
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            aria-label="Nama"
            className={inputClass}
            placeholder="Contoh: Nasi"
          />
        </div>

        <div className={sectionClass}>
          <SectionTitle>Bahan baku</SectionTitle>

          {recipeOptions.length === 0 && (
            <p className="mb-2 rounded-md bg-[#4a452e] px-3 py-2 text-xs text-yellow-200">
              Belum ada bahan baku yang ditandai Bahan Resep. Aktifkan di tab Bahan Baku.
            </p>
          )}

          <div className="space-y-2">
            {form.components.map((component, index) => {
              return (
                <div key={index} className="grid grid-cols-[minmax(0,1fr)_32px] items-center gap-2">
                  <CreatableSelect2
                    options={optionsByRow[index]}
                    value={component.stockItemId}
                    onSelect={(option) => setComponent(index, option?.id ? String(option.id) : "")}
                    placeholder="Pilih bahan baku"
                    label={`Bahan ${index + 1}`}
                    maxResults={MAX_BAHAN_RESULTS}
                    notFound={notFoundFor(index)}
                    disabled={isSaving}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        components:
                          current.components.length > 1
                            ? current.components.filter((_, componentIndex) => componentIndex !== index)
                            : [emptyComponent()],
                      }))
                    }
                    aria-label={`Hapus bahan ${index + 1}`}
                    className="h-full rounded-md bg-[#333] text-sm font-bold text-red-400"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() =>
              setForm((current) => ({
                ...current,
                components: [...current.components, emptyComponent()],
              }))
            }
            className="mt-2 w-full rounded-lg border border-dashed border-[#555] py-2 text-sm font-semibold text-[#d6c7ae] hover:border-[#d6c7ae]"
          >
            + Tambah Bahan Baku
          </button>
        </div>

        <fieldset className={sectionClass}>
          <legend className="sr-only">Sisa di akhir hari</legend>
          <SectionTitle>Sisa di akhir hari</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            {LEFTOVER_OPTIONS.map((option) => {
              const isSelected = form.resetDaily === option.resetDaily;

              return (
                <label
                  key={option.label}
                  className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${
                    isSelected ? "border-[#a79981] bg-[#2a2620]" : "border-[#333] hover:border-[#555]"
                  }`}
                >
                  <input
                    type="radio"
                    name="resetDaily"
                    checked={isSelected}
                    onChange={() => setForm((current) => ({ ...current, resetDaily: option.resetDaily }))}
                    className="mt-1 h-4 w-4 accent-[#a79981]"
                  />
                  <span>
                    <span className="block text-sm font-semibold">{option.label}</span>
                    <span className="block text-xs text-[#ababab]">{option.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

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
            disabled={isSaving}
            className="rounded-lg bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PreparedItemDialog;
