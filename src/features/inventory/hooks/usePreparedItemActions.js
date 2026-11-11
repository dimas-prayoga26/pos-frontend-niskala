import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  addSemiItem,
  deleteSemiItem,
  deleteSemiProduction,
  recordSemiProduction,
  updateSemiItem,
} from "../api";

const showError = (fallback) => (error) => {
  enqueueSnackbar(error?.response?.data?.message || fallback, { variant: "error" });
};

// Bahan olahan actions: save or delete the item, record a cooking and
// undo the latest one. Buang is useWasteActions.
// Callers pass callbacks to close their dialog.
const usePreparedItemActions = ({ onSaved, onDeleted, onProduced }) => {
  const queryClient = useQueryClient();
  // Cooking also moves bahan baku stock, so both lists are refreshed.
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["semi-items"] });
    queryClient.invalidateQueries({ queryKey: ["stock-items"] });
    queryClient.invalidateQueries({ queryKey: ["semi-productions"] });
    queryClient.invalidateQueries({ queryKey: ["stock-wastes"] });
  };

  const saveMutation = useMutation({
    mutationFn: ({ id, ...payload }) =>
      id ? updateSemiItem({ semiItemId: id, ...payload }) : addSemiItem(payload),
    onSuccess: (response, { id }) => {
      refresh();
      enqueueSnackbar(
        id ? "Bahan olahan diperbarui." : "Bahan olahan ditambahkan.",
        { variant: "success" }
      );
      onSaved?.(response?.data?.data);
    },
    onError: showError("Gagal menyimpan bahan olahan."),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteSemiItem,
    onSuccess: () => {
      refresh();
      enqueueSnackbar("Bahan berhasil dihapus.", { variant: "success" });
      onDeleted?.();
    },
    onError: showError("Gagal menghapus bahan."),
  });
  const produceMutation = useMutation({
    mutationFn: recordSemiProduction,
    onSuccess: () => {
      refresh();
      enqueueSnackbar("Catatan masak disimpan.", { variant: "success" });
      onProduced?.();
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
  };
};

export default usePreparedItemActions;
