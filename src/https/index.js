import { axiosWrapper } from "./axiosWrapper";

// API Endpoints

// Auth Endpoints
export const login = (data) => axiosWrapper.post("/api/user/login", data);
export const register = (data) => axiosWrapper.post("/api/user/register", data);
export const getUserData = () => axiosWrapper.get("/api/user");
export const getUsers = () => axiosWrapper.get("/api/user/all");
export const logout = () => axiosWrapper.post("/api/user/logout");

// Category Endpoints
export const addCategory = (data) => axiosWrapper.post("/api/category/", data);
export const getCategories = (params = {}) =>
  axiosWrapper.get("/api/category", { params });
export const updateCategory = ({ categoryId, ...categoryData }) =>
  axiosWrapper.put(`/api/category/${categoryId}`, categoryData);
export const updateCategoryPositions = (categoryIds) =>
  axiosWrapper.put("/api/category/positions", { categoryIds });
export const deleteCategory = (categoryId) =>
  axiosWrapper.delete(`/api/category/${categoryId}`);

// Menu Item Endpoints
export const addMenuItem = (data) => axiosWrapper.post("/api/menu-item/", data);
export const uploadMenuImage = (data) =>
  axiosWrapper.post("/api/menu-item/upload-image", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const getMenuItems = (categoryIdOrParams) => {
  const params =
    categoryIdOrParams && typeof categoryIdOrParams === "object"
      ? categoryIdOrParams
      : { categoryId: categoryIdOrParams };

  return axiosWrapper.get("/api/menu-item", { params });
};
export const updateMenuItem = ({ menuItemId, ...menuItemData }) =>
  axiosWrapper.put(`/api/menu-item/${menuItemId}`, menuItemData);
export const deleteMenuItem = (menuItemId) =>
  axiosWrapper.delete(`/api/menu-item/${menuItemId}`);

// Order Endpoints
export const addOrder = (data) => axiosWrapper.post("/api/order/", data);
export const createThermalPrintUrl = ({ orderId, payload }) =>
  axiosWrapper.post(`/api/order/${orderId}/thermal-print-url`, { payload });
export const createDraftThermalPrintUrl = ({ payload }) =>
  axiosWrapper.post("/api/order/draft/thermal-print-url", { payload });
export const getOrders = () => axiosWrapper.get("/api/order");
export const deleteOrder = (orderId) =>
  axiosWrapper.delete(`/api/order/${orderId}`);
export const updateOrderStatus = ({ orderId, orderStatus }) =>
  axiosWrapper.put(`/api/order/${orderId}`, { orderStatus });
export const updateCateringPaymentStatus = ({ orderId, isPaid }) =>
  axiosWrapper.put(`/api/order/${orderId}/catering-payment`, { isPaid });
export const addCateringPayment = ({ orderId, amount }) =>
  axiosWrapper.patch(`/api/order/${orderId}/catering-payment/add`, { amount });
export const getOrderPlatforms = (params = {}) =>
  axiosWrapper.get("/api/order-platform", { params });
export const addOrderPlatform = (data) =>
  axiosWrapper.post("/api/order-platform", data);
export const updateOrderPlatform = ({ platformId, ...platformData }) =>
  axiosWrapper.put(`/api/order-platform/${platformId}`, platformData);
export const deleteOrderPlatform = (platformId) =>
  axiosWrapper.delete(`/api/order-platform/${platformId}`);

// Recap Endpoints
export const getRecapMeta = (params = {}) =>
  axiosWrapper.get("/api/recap/meta", { params });
export const getRecaps = (periodType) => axiosWrapper.get(`/api/recap/${periodType}`);
export const addRecap = ({ periodType, data }) =>
  axiosWrapper.post(`/api/recap/${periodType}`, data);
export const addDailyCash = ({ recapId, ...data }) =>
  axiosWrapper.patch(`/api/recap/daily/${recapId}/cash`, data);

// Stock Item Endpoints
export const getShoppingSuppliers = () => axiosWrapper.get("/api/shopping/suppliers");
export const addSupplier = (data) => axiosWrapper.post("/api/shopping/suppliers", data);
export const updateSupplier = ({ id, ...data }) => axiosWrapper.put(`/api/shopping/suppliers/${id}`, data);
export const getPurchases = (params) => axiosWrapper.get("/api/shopping/purchases", { params });
export const savePurchase = (data) => axiosWrapper.post("/api/shopping/purchases", data);
// Draft nota: saved by staff, posted (approved) by an admin.
export const getPurchaseDrafts = () => axiosWrapper.get("/api/shopping/purchases/drafts");
export const updatePurchaseDraft = ({ id, ...data }) => axiosWrapper.put(`/api/shopping/purchases/${id}`, data);
export const deletePurchaseDraft = (id) => axiosWrapper.delete(`/api/shopping/purchases/${id}`);
export const updatePurchaseItem = ({ id, ...data }) =>
  axiosWrapper.put(`/api/shopping/purchase-items/${id}`, data);
export const deletePurchaseItem = (id) =>
  axiosWrapper.delete(`/api/shopping/purchase-items/${id}`);
// Bukti nota: photos of a purchase's paper receipt.
export const uploadPurchaseAttachments = ({ purchaseId, files }) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file, file.name));
  return axiosWrapper.post(`/api/shopping/purchases/${purchaseId}/attachments`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};
export const deletePurchaseAttachment = (attachmentId) =>
  axiosWrapper.delete(`/api/shopping/purchase-attachments/${attachmentId}`);
// Belanja perlengkapan (peralatan, operasional, promosi): the same nota form.
export const getSupplyPurchases = (params) =>
  axiosWrapper.get("/api/shopping/supply-purchases", { params });
export const saveSupplyPurchase = (data) => axiosWrapper.post("/api/shopping/supply-purchases", data);
export const getSupplyPurchaseDrafts = () => axiosWrapper.get("/api/shopping/supply-purchases/drafts");
export const updateSupplyPurchaseDraft = ({ id, ...data }) =>
  axiosWrapper.put(`/api/shopping/supply-purchases/${id}`, data);
export const deleteSupplyPurchaseDraft = (id) => axiosWrapper.delete(`/api/shopping/supply-purchases/${id}`);
export const updateSupplyPurchaseItem = ({ id, ...data }) =>
  axiosWrapper.put(`/api/shopping/supply-purchase-items/${id}`, data);
export const deleteSupplyPurchaseItem = (id) =>
  axiosWrapper.delete(`/api/shopping/supply-purchase-items/${id}`);
export const uploadSupplyPurchaseAttachments = ({ purchaseId, files }) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file, file.name));
  return axiosWrapper.post(`/api/shopping/supply-purchases/${purchaseId}/attachments`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};
export const deleteSupplyPurchaseAttachment = (attachmentId) =>
  axiosWrapper.delete(`/api/shopping/supply-purchase-attachments/${attachmentId}`);
// Sumber pembayaran and their saldo (admin only).
export const getPaymentSources = (params = {}) =>
  axiosWrapper.get("/api/payment-source", { params });
export const addPaymentSource = (data) => axiosWrapper.post("/api/payment-source", data);
export const updatePaymentSource = ({ id, ...data }) =>
  axiosWrapper.put(`/api/payment-source/${id}`, data);
export const getPaymentSourceMutations = ({ id, page = 1 }) =>
  axiosWrapper.get(`/api/payment-source/${id}/mutations`, { params: { page } });
export const addPaymentSourceMutation = ({ id, ...data }) =>
  axiosWrapper.post(`/api/payment-source/${id}/mutations`, data);
export const addStockItem = (data) => axiosWrapper.post("/api/stock-item/", data);
export const getStockItems = () => axiosWrapper.get("/api/stock-item");
export const updateStockItem = ({ stockItemId, ...stockItemData }) =>
  axiosWrapper.put(`/api/stock-item/${stockItemId}`, stockItemData);
export const updateStockQuantity = ({ stockItemId, stock }) =>
  axiosWrapper.patch(`/api/stock-item/${stockItemId}/stock`, { stock });
export const updateStockCogs = ({ stockItemId, ...data }) =>
  axiosWrapper.patch(`/api/stock-item/${stockItemId}/cogs`, data);
export const deleteStockItem = (stockItemId) =>
  axiosWrapper.delete(`/api/stock-item/${stockItemId}`);
// Bahan setengah jadi (stock_semi_items) and their cooking ("Catat Masak").
export const getSemiItems = () => axiosWrapper.get("/api/stock-item/semi");
export const addSemiItem = (data) => axiosWrapper.post("/api/stock-item/semi", data);
export const updateSemiItem = ({ semiItemId, ...data }) =>
  axiosWrapper.put(`/api/stock-item/semi/${semiItemId}`, data);
export const deleteSemiItem = (semiItemId) =>
  axiosWrapper.delete(`/api/stock-item/semi/${semiItemId}`);
export const updateSemiStock = ({ semiItemId, stock }) =>
  axiosWrapper.patch(`/api/stock-item/semi/${semiItemId}/stock`, { stock });
export const getSemiProductions = (semiItemId) =>
  axiosWrapper.get(`/api/stock-item/semi/${semiItemId}/productions`);
export const recordSemiProduction = ({ semiItemId, ...data }) =>
  axiosWrapper.post(`/api/stock-item/semi/${semiItemId}/productions`, data);
export const deleteSemiProduction = (productionId) =>
  axiosWrapper.delete(`/api/stock-item/semi/productions/${productionId}`);
// Kerugian: portions of a bahan setengah jadi thrown away.
export const getSemiWastes = (params = {}) =>
  axiosWrapper.get("/api/stock-item/semi/wastes", { params });
export const recordSemiWaste = ({ semiItemId, ...data }) =>
  axiosWrapper.post(`/api/stock-item/semi/${semiItemId}/wastes`, data);
export const deleteSemiWaste = (wasteId) =>
  axiosWrapper.delete(`/api/stock-item/semi/wastes/${wasteId}`);
// Perlengkapan (stock_supply_items): peralatan, operasional, promosi.
export const getSupplyItems = () => axiosWrapper.get("/api/stock-item/supply");
export const addSupplyItem = (data) => axiosWrapper.post("/api/stock-item/supply", data);
export const updateSupplyItem = ({ supplyItemId, ...data }) =>
  axiosWrapper.put(`/api/stock-item/supply/${supplyItemId}`, data);
export const updateSupplyStock = ({ supplyItemId, stock }) =>
  axiosWrapper.patch(`/api/stock-item/supply/${supplyItemId}/stock`, { stock });
export const deleteSupplyItem = (supplyItemId) =>
  axiosWrapper.delete(`/api/stock-item/supply/${supplyItemId}`);
