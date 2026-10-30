import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { PURCHASE_KINDS } from "../utils/purchaseKinds";
import { lineTotal, parseShoppingQuantity, unitPriceFromTotal } from "../utils/shopping";

const EMPTY_EDIT_FORM = { quantity: "", unit: "", packSize: "", unitPrice: "" };

// Edit and delete of a single purchase line (admin only). Both change stock on
// the server, so stock items and purchases are refetched afterwards.
const usePurchaseItemActions = (kind = PURCHASE_KINDS.raw) => {
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);

  const refreshAfterItemChange = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [kind.stockKey] }),
      queryClient.invalidateQueries({ queryKey: [kind.historyKey] }),
      queryClient.invalidateQueries({ queryKey: ["purchase-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["payment-sources"] }),
      queryClient.invalidateQueries({ queryKey: ["payment-source-mutations"] }),
    ]);
  };

  const updateItemMutation = useMutation({
    mutationFn: (data) => kind.updateItem(data),
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
    mutationFn: (id) => kind.deleteItem(id),
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
      packSize: item.packSize ? String(item.packSize) : "",
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

    // Isi per Kemasan: sent when set, or as null to drop the one the line had.
    const packText = String(editForm.packSize || "").trim();
    const packSize = packText ? parseShoppingQuantity(packText) : null;
    if (packText && (!Number.isFinite(packSize) || packSize <= 0)) {
      enqueueSnackbar("Isi per kemasan harus angka lebih dari 0, mis. 24.", { variant: "error" });
      return;
    }

    updateItemMutation.mutate({
      id: editingItem.id,
      quantity,
      unit: editForm.unit,
      ...(packText || editingItem.packSize != null ? { packSize } : {}),
      unitPrice: unitPriceFromTotal(quantity, editForm.unitPrice),
      // Kept as typed (see buildPurchasePayload).
      total: lineTotal({ unitPrice: editForm.unitPrice }),
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
