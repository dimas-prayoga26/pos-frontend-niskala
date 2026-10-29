// settings endpoints. Definitions still live in src/https/index.js (a file
// with uncommitted changes); move them here when that file is migrated.
export {
  addOrderPlatform,
  addPaymentSource,
  addPaymentSourceMutation,
  deleteOrderPlatform,
  getOrderPlatforms,
  getPaymentSourceMutations,
  getPaymentSources,
  updateOrderPlatform,
  updatePaymentSource,
} from "../../https";
