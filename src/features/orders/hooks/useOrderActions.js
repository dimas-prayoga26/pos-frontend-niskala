import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { addCateringPayment, deleteOrder } from "../api";

// Order mutations shared by the order cards. Deleting an order also returns its
// ingredients to stock on the server, so stock items are refetched too.
const useOrderActions = () => {
  const queryClient = useQueryClient();

  const cateringPaymentAddMutation = useMutation({
    mutationFn: addCateringPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      enqueueSnackbar("Pembayaran catering berhasil ditambahkan", {
        variant: "success",
      });
    },
    onError: (error) => {
      enqueueSnackbar(
        error?.response?.data?.message ||
          "Gagal menambahkan pembayaran catering",
        {
          variant: "error",
        }
      );
    },
  });

  const orderDeleteMutation = useMutation({
    mutationFn: deleteOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["stock-items"] });
      enqueueSnackbar("Pesanan berhasil dihapus", {
        variant: "success",
      });
    },
    onError: (error) => {
      enqueueSnackbar(
        error?.response?.data?.message || "Gagal menghapus pesanan",
        {
          variant: "error",
        }
      );
    },
  });

  return {
    addCateringPayment: (orderId, amount) =>
      cateringPaymentAddMutation.mutate({ orderId, amount }),
    isAddingCateringPayment: (orderId) =>
      cateringPaymentAddMutation.isPending &&
      cateringPaymentAddMutation.variables?.orderId === orderId,
    deleteOrder: (orderId) => orderDeleteMutation.mutate(orderId),
    isDeletingOrder: (orderId) =>
      orderDeleteMutation.isPending && orderDeleteMutation.variables === orderId,
  };
};

export default useOrderActions;
