import {
  deletePurchaseAttachment,
  deletePurchaseDraft,
  deletePurchaseItem,
  deleteSupplyPurchaseAttachment,
  deleteSupplyPurchaseDraft,
  deleteSupplyPurchaseItem,
  getPurchaseDrafts,
  getPurchases,
  getSupplyPurchaseDrafts,
  getSupplyPurchases,
  savePurchase,
  saveSupplyPurchase,
  updatePurchaseDraft,
  updatePurchaseItem,
  updateSupplyPurchaseDraft,
  updateSupplyPurchaseItem,
  uploadPurchaseAttachments,
  uploadSupplyPurchaseAttachments,
} from "../api";

export const SUPPLY_CATEGORIES = ["Peralatan", "Operasional", "Promosi"];
export const SUPPLY_CATEGORY_OPTIONS = SUPPLY_CATEGORIES.map((name) => ({ id: name, text: name }));

// Jenis Belanja. Both are made from the same "Tambah Belanja" form
// and share the nota (tanggal, toko, sumber pembayaran, bukti nota); they
// differ in where the items are stocked and which endpoints record them.
export const PURCHASE_KINDS = {
  raw: {
    key: "raw",
    label: "Bahan Baku",
    hint: "Masuk Stok → Bahan Baku, dipakai resep menu dan HPP.",
    itemIdKey: "stockItemId",
    historyKey: "purchases",
    stockKey: "stock-items",
    list: getPurchases,
    save: savePurchase,
    listDrafts: getPurchaseDrafts,
    updateDraft: updatePurchaseDraft,
    deleteDraft: deletePurchaseDraft,
    updateItem: updatePurchaseItem,
    deleteItem: deletePurchaseItem,
    uploadAttachments: uploadPurchaseAttachments,
    deleteAttachment: deletePurchaseAttachment,
  },
  supply: {
    key: "supply",
    label: "Perlengkapan",
    hint: "Peralatan, operasional, dan promosi. Masuk Stok → Perlengkapan, tidak masuk HPP.",
    itemIdKey: "supplyItemId",
    historyKey: "supply-purchases",
    stockKey: "supply-items",
    list: getSupplyPurchases,
    save: saveSupplyPurchase,
    listDrafts: getSupplyPurchaseDrafts,
    updateDraft: updateSupplyPurchaseDraft,
    deleteDraft: deleteSupplyPurchaseDraft,
    updateItem: updateSupplyPurchaseItem,
    deleteItem: deleteSupplyPurchaseItem,
    uploadAttachments: uploadSupplyPurchaseAttachments,
    deleteAttachment: deleteSupplyPurchaseAttachment,
  },
};
export const PURCHASE_KIND_LIST = [PURCHASE_KINDS.raw, PURCHASE_KINDS.supply];
