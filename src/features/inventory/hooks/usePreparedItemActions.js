import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  addPreparedItem,
  deletePreparedProduction,
  recordPreparedProduction,
  updatePreparedItem,
  updateStockQuantity,
} from "../api";

const showError = (fallback) => (error) => {
  enqueueSnackbar(error?.response?.data?.message || fallback, { variant: "error" });
};

// Bahan olahan actions: save the item, record a cooking, undo the latest one
// and adjust leftover portions. Callers pass callbacks to close their dialog.
const usePreparedItemActions = ({ onSaved, onProduced, onAdjusted }) => {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["stock-items"] });
    queryClient.invalidateQueries({ queryKey: ["prepared-productions"] });
  };

  const saveMutation = useMutation({
    mutationFn: ({ id, ...payload }) =>
      id ? updatePreparedItem({ stockItemId: id, ...payload }) : addPreparedItem(payload),
    onSuccess: (_response, { id }) => {
      refresh();
      enqueueSnackbar(id ? "Bahan olahan diperbarui." : "Bahan olahan ditambahkan.", {
        variant: "success",
      });
      onSaved();
    },
    onError: showError("Gagal menyimpan bahan olahan."),
  });
  const produceMutation = useMutation({
    mutationFn: recordPreparedProduction,
    onSuccess: () => {
      refresh();
      enqueueSnackbar("Catatan masak disimpan.", { variant: "success" });
      onProduced();
    },
    onError: showError("Gagal menyimpan catatan masak."),
  });
  const undoMutation = useMutation({
    mutationFn: deletePreparedProduction,
    onSuccess: () => {
      refresh();
      enqueueSnackbar("Catatan masak dibatalkan.", { variant: "success" });
    },
    onError: showError("Gagal membatalkan catatan masak."),
  });
  const adjustMutation = useMutation({
    mutationFn: updateStockQuantity,
    onSuccess: () => {
      refresh();
      enqueueSnackbar("Stok bahan olahan disesuaikan.", { variant: "success" });
      onAdjusted();
    },
    onError: showError("Gagal menyesuaikan stok."),
  });

  return {
    save: (payload) => saveMutation.mutate(payload),
    isSaving: saveMutation.isPending,
    produce: (item, payload) =>
      produceMutation.mutate({ stockItemId: item.id || item._id, ...payload }),
    isProducing: produceMutation.isPending,
    undoProduction: (productionId) => undoMutation.mutate(productionId),
    isUndoing: undoMutation.isPending,
    adjustStock: (item, stock) =>
      adjustMutation.mutate({ stockItemId: item.id || item._id, stock }),
    isAdjusting: adjustMutation.isPending,
  };
};

export default usePreparedItemActions;
