import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { addStockItem, deleteStockItem, updateStockCogs } from "../api";

// Admin actions on stock items. Callers pass onSuccess to close their dialog.
const useStockItemActions = ({ onCreated = () => {}, onDeleted, onCogsSaved }) => {
  const queryClient = useQueryClient();
  const refreshStockItems = () => {
    queryClient.invalidateQueries({ queryKey: ["stock-items"] });
  };

  const createMutation = useMutation({
    mutationFn: addStockItem,
    onSuccess: () => {
      refreshStockItems();
      enqueueSnackbar("Bahan berhasil ditambahkan.", { variant: "success" });
      onCreated();
    },
    onError: (error) => {
      enqueueSnackbar(error?.response?.data?.message || "Gagal menambahkan bahan.", {
        variant: "error",
      });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteStockItem,
    onSuccess: () => {
      refreshStockItems();
      enqueueSnackbar("Bahan berhasil dihapus.", { variant: "success" });
      onDeleted();
    },
    onError: (error) => {
      enqueueSnackbar(error?.response?.data?.message || "Gagal menghapus bahan.", {
        variant: "error",
      });
    },
  });
  const cogsMutation = useMutation({
    mutationFn: updateStockCogs,
    onSuccess: () => {
      refreshStockItems();
      enqueueSnackbar("COGS awal berhasil diubah.", { variant: "success" });
      onCogsSaved();
    },
    onError: () => {
      enqueueSnackbar("Gagal mengubah COGS awal.", { variant: "error" });
    },
  });

  return {
    createItem: (payload) => createMutation.mutate(payload),
    isCreating: createMutation.isPending,
    deleteItem: (item) => deleteMutation.mutate(item.id || item._id),
    isDeleting: deleteMutation.isPending,
    saveCogs: (item, { averageCost, supplier }) =>
      cogsMutation.mutate({ stockItemId: item.id || item._id, averageCost, supplier }),
    isSavingCogs: cogsMutation.isPending,
  };
};

export default useStockItemActions;
