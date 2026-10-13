// inventory endpoints. Definitions still live in src/https/index.js (a file
// with uncommitted changes); move them here when that file is migrated.
export {
  addSupplier,
  deletePurchaseItem,
  deleteStockItem,
  getPurchases,
  getShoppingSuppliers,
  getStockItems,
  savePurchase,
  updatePurchaseItem,
  updateStockCogs,
  updateSupplier,
} from "../../https";
