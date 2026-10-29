import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { currency } from "../../utils/format";
import { PURCHASE_KINDS } from "../../utils/purchaseKinds";

const actionClass = "rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50";

// Draft nota waiting to be posted (approved). Staff open them to change, admins
// to check and post; both may add photos or throw a draft away. Drafts never
// moved stock or saldo.
const PurchaseDraftsPanel = ({ drafts, canPost, onOpen, onOpenReceipts, onDeleted }) => {
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: (draft) => PURCHASE_KINDS[draft.kind].deleteDraft(draft.id),
    onSuccess: async (_result, draft) => {
      enqueueSnackbar(`Draft nota #${draft.id} dihapus.`, { variant: "success" });
      onDeleted(draft);
      await queryClient.invalidateQueries({ queryKey: ["purchase-drafts"] });
    },
    onError: (error) =>
      enqueueSnackbar(error?.response?.data?.message || "Gagal menghapus draft nota.", { variant: "error" }),
  });

  if (!drafts.length) return null;

  const remove = (draft) => {
    if (!window.confirm(`Hapus draft nota #${draft.id} dari ${draft.supplierName}?`)) return;
    deleteMutation.mutate(draft);
  };

  return (
    <section aria-label="Draft nota" className="mb-4 rounded-lg border border-[#f6d365]/40 bg-[#f6d365]/5 p-3">
      <h4 className="font-bold text-[#f6d365]">Draft Nota Menunggu Posting ({drafts.length})</h4>
      <p className="mt-1 text-xs text-[#ababab]">
        Stok dan saldo belum berubah. {canPost ? "Periksa lalu posting." : "Admin akan memeriksa dan memposting."}
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[#ababab]">
            <tr>
              <th className="p-2">Tanggal</th>
              <th className="p-2">Jenis</th>
              <th className="p-2">Toko</th>
              <th className="p-2">Barang</th>
              <th className="p-2 text-right">Grand Total</th>
              <th className="p-2">Dibuat</th>
              <th className="p-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((draft) => (
              <tr key={`${draft.kind}-${draft.id}`} className="border-t border-[#444]">
                <td className="whitespace-nowrap p-2">
                  {String(draft.date).slice(0, 10)}
                  <p className="text-xs text-[#ababab]">#{draft.id}</p>
                </td>
                <td className="p-2">{PURCHASE_KINDS[draft.kind]?.label}</td>
                <td className="p-2">{draft.supplierName}</td>
                <td className="p-2 text-[#ababab]">{draft.items.map((item) => item.itemName).join(", ")}</td>
                <td className="whitespace-nowrap p-2 text-right font-semibold">{currency(draft.total)}</td>
                <td className="p-2 text-[#ababab]">{draft.createdBy || "-"}</td>
                <td className="p-2">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onOpen(draft)}
                      className={`${actionClass} bg-[#a79981] text-[#101010]`}
                    >
                      {canPost ? "Periksa & Posting" : "Ubah"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenReceipts(draft)}
                      className={`${actionClass} border border-[#a79981]/40 text-[#d6c7ae]`}
                    >
                      {draft.attachments.length ? `Bukti (${draft.attachments.length})` : "+ Bukti"}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(draft)}
                      disabled={deleteMutation.isPending}
                      className={`${actionClass} bg-[#331f1f] text-red-300`}
                    >
                      Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default PurchaseDraftsPanel;
