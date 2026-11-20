// settings endpoints. Definitions still live in src/https/index.js (a file
// with uncommitted changes); move them here when that file is migrated.
export {
  addOrderPlatform,
  addPaymentSource,
  addPaymentSourceMutation,
  deleteOrderPlatform,
  deleteUser,
  getCategories,
  getLoyaltyProgram,
  getLoyaltyRedemptions,
  getMenuItems,
  getOrderPlatforms,
  getPaymentSourceMutations,
  getPaymentSources,
  getUsers,
  register,
  updateCategoryBestSellerGroups,
  updateLoyaltyProgram,
  updateLoyaltyReward,
  updateOrderPlatform,
  updatePaymentSource,
  updateUser,
} from "../../https";
