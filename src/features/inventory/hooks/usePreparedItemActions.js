import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  addSemiItem,
  deleteSemiItem,
  deleteSemiProduction,
  recordSemiProduction,
  updateSemiItem,
  updateSemiStock,
} from "../api";

const showError = (fallback) => (error) => {
  enqueueSnackbar(error?.response?.data?.message || fallback, { variant: "error" });
};

// Bahan setengah jadi actions: save or delete the item, record a cooking, undo
// the latest one and adjust leftover portions. Callers pass callbacks to close
// their dialog.
const usePreparedItemActions = ({ onSaved, onDeleted, onProduced, onAdjusted }) => {
  const queryClient = useQueryClient();
  // Cooking also moves bahan baku stock, so both lists are refreshed.
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["semi-items"] });
    queryClient.invalidateQueries({ queryKey: ["stock-items"] });
    queryClient.invalidateQueries({ queryKey: ["semi-productions"] });
  };

  const saveMutation = useMutation({
    mutationFn: ({ id, ...payload }) =>
      id ? updateSemiItem({ semiItemId: id, ...payload }) : addSemiItem(payload),
    onSuccess: (_response, { id }) => {
      refresh();
      enqueueSnackbar(
        id ? "Bahan setengah jadi diperbarui." : "Bahan setengah jadi ditambahkan.",
        { variant: "success" }
      );
      onSaved();
    },
    onError: showError("Gagal menyimpan bahan setengah jadi."),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteSemiItem,
    onSuccess: () => {
      refresh();
      enqueueSnackbar("Bahan berhasil dihapus.", { variant: "success" });
      onDeleted();
    },
    onError: showError("Gagal menghapus bahan."),
  });
  const produceMutation = useMutation({
    mutationFn: recordSemiProduction,
    onSuccess: () => {
      refresh();
      enqueueSnackbar("Catatan masak disimpan.", { variant: "success" });
      onProduced();
    },
    onError: showError("Gagal menyimpan catatan masak."),
  });
  const undoMutation = useMutation({
    mutationFn: deleteSemiProduction,
    onSuccess: () => {
      refresh();
      enqueueSnackbar("Catatan masak dibatalkan.", { variant: "success" });
    },
    onError: showError("Gagal membatalkan catatan masak."),
  });
  const adjustMutation = useMutation({
    mutationFn: updateSemiStock,
    onSuccess: () => {
      refresh();
      enqueueSnackbar("Stok bahan setengah jadi disesuaikan.", { variant: "success" });
      onAdjusted();
    },
    onError: showError("Gagal menyesuaikan stok."),
  });

  return {
    save: (payload) => saveMutation.mutate(payload),
    isSaving: saveMutation.isPending,
    deleteItem: (item) => deleteMutation.mutate(item.id || item._id),
    isDeleting: deleteMutation.isPending,
    produce: (item, payload) =>
      produceMutation.mutate({ semiItemId: item.id || item._id, ...payload }),
    isProducing: produceMutation.isPending,
    undoProduction: (productionId) => undoMutation.mutate(productionId),
    isUndoing: undoMutation.isPending,
    adjustStock: (item, stock) =>
      adjustMutation.mutate({ semiItemId: item.id || item._id, stock }),
    isAdjusting: adjustMutation.isPending,
  };
};

export default usePreparedItemActions;
