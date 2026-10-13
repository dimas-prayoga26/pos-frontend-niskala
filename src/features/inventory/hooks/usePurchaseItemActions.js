import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { deletePurchaseItem, updatePurchaseItem } from "../api";
import { parseShoppingQuantity, unitPriceFromTotal } from "../utils/shopping";

const EMPTY_EDIT_FORM = { quantity: "", unit: "", unitPrice: "" };

// Edit and delete of a single purchase line (admin only). Both change stock on
// the server, so stock items and purchases are refetched afterwards.
const usePurchaseItemActions = () => {
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);

  const refreshAfterItemChange = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["stock-items"] }),
      queryClient.invalidateQueries({ queryKey: ["purchases"] }),
    ]);
  };

  const updateItemMutation = useMutation({
    mutationFn: updatePurchaseItem,
    onSuccess: async () => {
      enqueueSnackbar("Item belanja berhasil diubah.", { variant: "success" });
      setEditingItem(null);
      await refreshAfterItemChange();
    },
    onError: (error) => {
      enqueueSnackbar(error?.response?.data?.message || "Gagal mengubah item belanja.", {
        variant: "error",
      });
    },
  });
  const deleteItemMutation = useMutation({
    mutationFn: deletePurchaseItem,
    onSuccess: async () => {
      enqueueSnackbar("Item belanja berhasil dihapus.", { variant: "success" });
      await refreshAfterItemChange();
    },
    onError: (error) => {
      enqueueSnackbar(error?.response?.data?.message || "Gagal menghapus item belanja.", {
        variant: "error",
      });
    },
  });

  // The edit form, like the purchase form, takes the line total.
  const startEdit = (item) => {
    setEditingItem(item);
    setEditForm({
      quantity: String(item.quantity ?? ""),
      unit: item.unit || "",
      unitPrice: String(item.total ?? ""),
    });
  };

  const submitEdit = (event) => {
    event.preventDefault();
    const quantity = parseShoppingQuantity(editForm.quantity);

    if (
      !editingItem ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !editForm.unit ||
      editForm.unitPrice === ""
    ) {
      enqueueSnackbar("Lengkapi gramasi, satuan, dan harga total.", {
        variant: "error",
      });
      return;
    }

    updateItemMutation.mutate({
      id: editingItem.id,
      quantity,
      unit: editForm.unit,
      unitPrice: unitPriceFromTotal(quantity, editForm.unitPrice),
    });
  };

  const removeItem = (item) => {
    if (!window.confirm(`Hapus belanja ${item.itemName || "barang"} ini?`)) return;

    deleteItemMutation.mutate(item.id);
  };

  return {
    editingItem,
    setEditingItem,
    editForm,
    setEditForm,
    startEdit,
    submitEdit,
    isSaving: updateItemMutation.isPending,
    removeItem,
    isDeleting: deleteItemMutation.isPending,
  };
};

export default usePurchaseItemActions;
