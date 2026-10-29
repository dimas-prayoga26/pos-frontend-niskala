import {
  deletePurchaseAttachment,
  deletePurchaseDraft,
  deletePurchaseItem,
  deleteSupplyPurchaseAttachment,
  deleteSupplyPurchaseDraft,
  deleteSupplyPurchaseItem,
  getPurchaseDrafts,
  getPurchaseNotas,
  getPurchases,
  getSupplyPurchaseDrafts,
  getSupplyPurchaseNotas,
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

// Kategori of barang "Lainnya" (pos-backend supply.repository SUPPLY_CATEGORIES).
export const SUPPLY_CATEGORIES = ["Peralatan", "Perlengkapan", "Promosi", "Lain-lain"];
export const SUPPLY_CATEGORY_OPTIONS = SUPPLY_CATEGORIES.map((name) => ({ id: name, text: name }));

// Jenis Belanja. Both are made from the same "Tambah Belanja" form
// and share the nota (tanggal, toko, sumber pembayaran, bukti nota); they
// differ in where the items are stocked and which endpoints record them.
export const PURCHASE_KINDS = {
  raw: {
    key: "raw",
    label: "Bahan Baku",
    hint: "Masuk Stok → Bahan Baku, dipakai resep menu dan HPP.",
    // Bahan baku are bought in gr, ml, pcs, ... and converted to their stock unit.
    showUnits: true,
    // The per-item view of the Belanja history.
    itemViewLabel: "Per Bahan",
    // The moving average cost per stock unit: it is the COGS (HPP) of menus.
    costLabel: "COGS",
    itemIdKey: "stockItemId",
    historyKey: "purchases",
    stockKey: "stock-items",
    list: getPurchases,
    listNotas: getPurchaseNotas,
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
    label: "Lainnya",
    hint: "Peralatan, perlengkapan, promosi, dan lain-lain. Masuk Stok → Lainnya, tidak masuk HPP.",
    // Counted per piece: no unit is asked or shown.
    showUnits: false,
    itemViewLabel: "Per Barang",
    // Never in HPP: the moving average is only the average purchase price
    // (it values the stock), not a COGS.
    costLabel: "Harga Rata-rata",
    itemIdKey: "supplyItemId",
    historyKey: "supply-purchases",
    stockKey: "supply-items",
    list: getSupplyPurchases,
    listNotas: getSupplyPurchaseNotas,
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

// Tabs of the Belanja history: bahan baku, then barang Lainnya per kategori.
export const HISTORY_TABS = [
  { key: "raw", kindKey: "raw", label: PURCHASE_KINDS.raw.label, category: "" },
  ...SUPPLY_CATEGORIES.map((category) => ({ key: `supply:${category}`, kindKey: "supply", label: category, category })),
];
// Views of the Belanja history: Per Struk (each nota with its barang, the
// default) or per item (Per Bahan for bahan baku, Per Barang for Lainnya).
export const historyViewsOf = (kind) => [
  { key: "nota", label: "Per Struk" },
  { key: "item", label: kind.itemViewLabel },
];
export const historyTabOf = (kindKey, category = "") =>
  HISTORY_TABS.find((tab) => tab.kindKey === kindKey && (kindKey !== "supply" || tab.category === category)) ||
  HISTORY_TABS.find((tab) => tab.kindKey === kindKey);
