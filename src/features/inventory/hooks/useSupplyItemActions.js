import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { deleteSupplyItem, updateSupplyItem, updateSupplyStock } from "../api";

// Ubah, Sesuaikan and Hapus of perlengkapan. Callers pass callbacks to close
// their dialog.
const useSupplyItemActions = ({ onSaved, onAdjusted, onDeleted }) => {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["supply-items"] });
    queryClient.invalidateQueries({ queryKey: ["supply-purchases"] });
  };
  const showError = (fallback) => (error) =>
    enqueueSnackbar(error?.response?.data?.message || fallback, { variant: "error" });

  const saveMutation = useMutation({
    mutationFn: updateSupplyItem,
    onSuccess: () => {
      refresh();
      enqueueSnackbar("Barang lainnya berhasil diubah.", { variant: "success" });
      onSaved();
    },
    onError: showError("Gagal mengubah barang lainnya."),
  });
  const adjustMutation = useMutation({
    mutationFn: updateSupplyStock,
    onSuccess: () => {
      refresh();
      enqueueSnackbar("Stok barang lainnya disesuaikan.", { variant: "success" });
      onAdjusted();
    },
    onError: showError("Gagal menyesuaikan stok."),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteSupplyItem,
    onSuccess: () => {
      refresh();
      enqueueSnackbar("Barang lainnya dihapus.", { variant: "success" });
      onDeleted();
    },
    onError: showError("Gagal menghapus barang lainnya."),
  });

  return {
    save: (item, payload) => saveMutation.mutate({ supplyItemId: item.id, ...payload }),
    isSaving: saveMutation.isPending,
    adjust: (item, stock) => adjustMutation.mutate({ supplyItemId: item.id, stock }),
    isAdjusting: adjustMutation.isPending,
    deleteItem: (item) => deleteMutation.mutate(item.id),
    isDeleting: deleteMutation.isPending,
  };
};

export default useSupplyItemActions;
