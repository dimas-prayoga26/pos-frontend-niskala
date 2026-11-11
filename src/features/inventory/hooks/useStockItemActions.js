import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { addStockItem, deleteStockItem, updateStockCogs, updateStockRecipeUse } from "../api";

// Admin actions on stock items. Callers pass onSuccess to close their dialog.
const useStockItemActions = ({ onCreated, onDeleted, onCogsSaved }) => {
  const queryClient = useQueryClient();
  const refreshStockItems = () => {
    queryClient.invalidateQueries({ queryKey: ["stock-items"] });
  };

  // Tambah Bahan; a hidden bahan of the same name comes back (200 + message).
  // onCreated gets the bahan once the list has it.
  const createMutation = useMutation({
    mutationFn: addStockItem,
    onSuccess: async (response) => {
      enqueueSnackbar(response?.status === 200 ? response.data.message : "Bahan berhasil ditambahkan.", {
        variant: "success",
      });
      await queryClient.invalidateQueries({ queryKey: ["stock-items"] });
      onCreated?.(response?.data?.data);
    },
    onError: (error) => {
      enqueueSnackbar(error?.response?.data?.message || "Gagal menambahkan bahan.", { variant: "error" });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteStockItem,
    onSuccess: () => {
      refreshStockItems();
      enqueueSnackbar("Bahan berhasil dihapus.", { variant: "success" });
      onDeleted?.();
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
      onCogsSaved?.();
    },
    onError: () => {
      enqueueSnackbar("Gagal mengubah COGS awal.", { variant: "error" });
    },
  });

  // Bahan Resep on/off. The backend refuses "Tidak" while a recipe uses the bahan.
  const recipeUseMutation = useMutation({
    mutationFn: updateStockRecipeUse,
    onSuccess: (response) => {
      refreshStockItems();
      enqueueSnackbar(response?.data?.message || "Bahan Resep berhasil diubah.", { variant: "success" });
    },
    onError: (error) => {
      enqueueSnackbar(error?.response?.data?.message || "Gagal mengubah Bahan Resep.", {
        variant: "error",
      });
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
    setRecipeUse: (item, isRecipeIngredient) =>
      recipeUseMutation.mutate({ stockItemId: item.id || item._id, isRecipeIngredient }),
    recipeUsePendingId: recipeUseMutation.isPending ? recipeUseMutation.variables?.stockItemId : null,
  };
};

export default useStockItemActions;
