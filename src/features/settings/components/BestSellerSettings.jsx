import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { getCategories, updateCategoryBestSellerGroups } from "../api";
import { BEST_SELLER_GROUPS } from "../../home/utils/bestSeller";
import CreatableSelect2 from "../../../shared/ui/CreatableSelect2";

// One column per Best Seller tab on Home, then the categories not shown
// (group null).
const columns = [...BEST_SELLER_GROUPS.map((group) => ({ group, label: group })), { group: null, label: "Dikecualikan" }];

// Pengaturan → Best Seller: which tab of Best Seller on Home (Makanan, Minuman,
// Snack) ranks the menus of each category, or none. Each column lists its
// categories; a category joins a column from that column's picker and leaves
// it with × (back to Dikecualikan: left out of Best Seller). Saved for all at once.
export default function BestSellerSettings() {
  const queryClient = useQueryClient();
  // Changes not saved yet: category id → group (null: not shown).
  const [draft, setDraft] = useState({});
  const categoriesQuery = useQuery({
    queryKey: ["categories", "best-seller"],
    queryFn: () => getCategories({ includeInactive: true }),
  });
  const categories = categoriesQuery.data?.data?.data || [];
  const savedGroupOf = (category) => category.bestSellerGroup ?? null;
  const groupOf = (category) =>
    Object.prototype.hasOwnProperty.call(draft, category.id) ? draft[category.id] : savedGroupOf(category);
  const isChanged = (category) => groupOf(category) !== savedGroupOf(category);
  const isDirty = categories.some(isChanged);
  const moveTo = (categoryId, group) => setDraft((previous) => ({ ...previous, [categoryId]: group }));

  const saveMutation = useMutation({
    mutationFn: updateCategoryBestSellerGroups,
    onSuccess: async () => {
      enqueueSnackbar("Kategori Best Seller disimpan.", { variant: "success" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["categories"] }),
        queryClient.invalidateQueries({ queryKey: ["menu-items"] }),
      ]);
      setDraft({});
    },
    onError: (error) =>
      enqueueSnackbar(error?.response?.data?.message || "Gagal menyimpan kategori Best Seller.", { variant: "error" }),
  });

  const save = () => {
    if (!isDirty || saveMutation.isPending) return;
    saveMutation.mutate(
      Object.fromEntries(
        BEST_SELLER_GROUPS.map((group) => [
          group,
          categories.filter((category) => groupOf(category) === group).map((category) => category.id),
        ])
      )
    );
  };

  // The picker of a column: every category in another column, grouped by it.
  const pickerOptions = (group) =>
    columns
      .filter((column) => column.group !== group)
      .map((column) => ({
        text: column.label,
        children: categories
          .filter((category) => groupOf(category) === column.group)
          .map((category) => ({ id: category.id, text: category.name })),
      }))
      .filter((option) => option.children.length);

  return (
    <div className="rounded-lg bg-[#1f1f1f] p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-bold text-[#f5f5f5]">Kategori Best Seller</h3>
        <div className="flex gap-2">
          {isDirty && (
            <button
              type="button"
              onClick={() => setDraft({})}
              disabled={saveMutation.isPending}
              className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5] disabled:opacity-60"
            >
              Batal
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={!isDirty || saveMutation.isPending}
            className="rounded-lg bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010] disabled:opacity-50"
          >
            {saveMutation.isPending ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>

      {categoriesQuery.isError ? (
        <p role="alert" className="py-4 text-red-300">
          Kategori gagal dimuat.{" "}
          <button type="button" onClick={() => categoriesQuery.refetch()} className="underline">
            Coba lagi
          </button>
        </p>
      ) : categoriesQuery.isPending ? (
        <p className="py-5 text-center text-sm text-[#ababab]">Memuat kategori...</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((column) => {
            const members = categories.filter((category) => groupOf(category) === column.group);
            return (
              <section
                key={column.label}
                aria-label={`Kolom ${column.label}`}
                className="flex min-w-0 flex-col rounded-lg border border-[#333] bg-[#262626] p-3"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className={`font-bold ${column.group ? "text-[#f5f5f5]" : "text-[#ababab]"}`}>{column.label}</h4>
                  <span className="rounded-md bg-[#333] px-2 py-0.5 text-xs font-bold text-[#ababab]">{members.length}</span>
                </div>

                <CreatableSelect2
                  options={pickerOptions(column.group)}
                  value=""
                  onSelect={(option) => option && moveTo(Number(option.id), column.group)}
                  placeholder="+ Tambah kategori"
                  label={`Tambah kategori ke ${column.label}`}
                  disabled={saveMutation.isPending}
                />

                <ul aria-label={`Kategori ${column.label}`} className="mt-3 space-y-2">
                  {members.map((category) => (
                    <li
                      key={category.id}
                      className={`flex items-center justify-between gap-2 rounded-md bg-[#1f1f1f] px-3 py-2 text-sm font-semibold text-[#f5f5f5] ${
                        isChanged(category) ? "ring-1 ring-[#a79981]" : ""
                      }`.trim()}
                    >
                      <span className="min-w-0 break-words">
                        {category.name}
                        {!category.isActive && (
                          <span className="ml-2 rounded bg-red-900/60 px-1.5 py-0.5 text-[10px] font-bold text-red-300">
                            Nonaktif
                          </span>
                        )}
                      </span>
                      {column.group && (
                        <button
                          type="button"
                          onClick={() => moveTo(category.id, null)}
                          disabled={saveMutation.isPending}
                          aria-label={`Keluarkan ${category.name} dari ${column.label}`}
                          className="shrink-0 rounded px-1.5 text-base leading-none text-[#ababab] hover:bg-[#333] hover:text-red-300 disabled:opacity-50"
                        >
                          ×
                        </button>
                      )}
                    </li>
                  ))}
                  {!members.length && <li className="py-2 text-center text-xs text-[#777]">Belum ada kategori</li>}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
