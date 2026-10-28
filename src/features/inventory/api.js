// inventory endpoints. Definitions still live in src/https/index.js (a file
// with uncommitted changes); move them here when that file is migrated.
export {
  addPreparedItem,
  addSupplier,
  deletePreparedProduction,
  deletePurchaseItem,
  deleteStockItem,
  getPreparedProductions,
  getPurchases,
  getShoppingSuppliers,
  getStockItems,
  recordPreparedProduction,
  savePurchase,
  updatePreparedItem,
  updatePurchaseItem,
  updateStockCogs,
  updateStockQuantity,
  updateSupplier,
} from "../../https";
