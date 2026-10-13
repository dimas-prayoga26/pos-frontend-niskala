import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { deleteStockItem, updateStockCogs } from "../api";

// Admin actions on stock items. Callers pass onSuccess to close their dialog.
const useStockItemActions = ({ onDeleted, onCogsSaved }) => {
  const queryClient = useQueryClient();
  const refreshStockItems = () => {
    queryClient.invalidateQueries({ queryKey: ["stock-items"] });
  };

  const deleteMutation = useMutation({
    mutationFn: deleteStockItem,
    onSuccess: () => {
      refreshStockItems();
      enqueueSnackbar("Bahan berhasil dihapus.", { variant: "success" });
      onDeleted();
    },
    onError: () => {
      enqueueSnackbar("Gagal menghapus bahan.", { variant: "error" });
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
    deleteItem: (item) => deleteMutation.mutate(item.id || item._id),
    isDeleting: deleteMutation.isPending,
    saveCogs: (item, { averageCost, supplier }) =>
      cogsMutation.mutate({ stockItemId: item.id || item._id, averageCost, supplier }),
    isSavingCogs: cogsMutation.isPending,
  };
};

export default useStockItemActions;
