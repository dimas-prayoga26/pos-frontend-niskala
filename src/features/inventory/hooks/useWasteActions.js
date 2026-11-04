import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { deleteSemiWaste, deleteStockWaste, recordSemiWaste, recordStockWaste } from "../api";

const showError = (fallback) => (error) => {
  enqueueSnackbar(error?.response?.data?.message || fallback, { variant: "error" });
};

// Buang (Modul 3): throw away bahan baku (kind "raw") or bahan olahan
// (kind "semi") with their bukti foto, or undo the latest write-off of an
// item. onWasted closes the Buang dialog.
const useWasteActions = ({ onWasted }) => {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["stock-items"] });
    queryClient.invalidateQueries({ queryKey: ["semi-items"] });
    queryClient.invalidateQueries({ queryKey: ["stock-wastes"] });
  };

  const wasteMutation = useMutation({
    mutationFn: ({ kind, itemId, ...payload }) =>
      kind === "semi"
        ? recordSemiWaste({ semiItemId: itemId, ...payload })
        : recordStockWaste({ stockItemId: itemId, ...payload }),
    onSuccess: () => {
      refresh();
      enqueueSnackbar("Kerugian dicatat.", { variant: "success" });
      onWasted();
    },
    onError: showError("Gagal mencatat kerugian."),
  });
  const undoMutation = useMutation({
    mutationFn: ({ kind, id }) => (kind === "semi" ? deleteSemiWaste(id) : deleteStockWaste(id)),
    onSuccess: () => {
      refresh();
      enqueueSnackbar("Catatan buang dibatalkan, jumlahnya kembali ke stok.", { variant: "success" });
    },
    onError: showError("Gagal membatalkan catatan buang."),
  });

  return {
    waste: (kind, item, payload) => wasteMutation.mutate({ kind, itemId: item.id || item._id, ...payload }),
    isWasting: wasteMutation.isPending,
    undoWaste: (waste) => undoMutation.mutate({ kind: waste.kind, id: waste.id }),
    isUndoingWaste: undoMutation.isPending,
  };
};

export default useWasteActions;
