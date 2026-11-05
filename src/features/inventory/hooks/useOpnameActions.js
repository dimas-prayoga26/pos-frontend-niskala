import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { deleteStockOpname, recordStockOpname } from "../api";

const showError = (fallback) => (error) => {
  enqueueSnackbar(error?.response?.data?.message || fallback, { variant: "error" });
};

// Stock Opname (Modul 3): save the physical counts of one kind, or undo the
// latest count of an item. onRecorded closes the Stock Opname dialog.
const useOpnameActions = ({ onRecorded }) => {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["stock-items"] });
    queryClient.invalidateQueries({ queryKey: ["semi-items"] });
    queryClient.invalidateQueries({ queryKey: ["stock-opnames"] });
  };

  const recordMutation = useMutation({
    mutationFn: recordStockOpname,
    onSuccess: (response) => {
      refresh();
      enqueueSnackbar(response?.data?.message || "Stock opname disimpan.", { variant: "success" });
      onRecorded();
    },
    onError: showError("Gagal menyimpan stock opname."),
  });
  const undoMutation = useMutation({
    mutationFn: deleteStockOpname,
    onSuccess: () => {
      refresh();
      enqueueSnackbar("Stock opname dibatalkan, stok kembali seperti sebelumnya.", { variant: "success" });
    },
    onError: showError("Gagal membatalkan stock opname."),
  });

  return {
    record: (payload) => recordMutation.mutate(payload),
    isRecording: recordMutation.isPending,
    undo: (opname) => undoMutation.mutate({ kind: opname.kind, id: opname.id }),
    isUndoing: undoMutation.isPending,
  };
};

export default useOpnameActions;
