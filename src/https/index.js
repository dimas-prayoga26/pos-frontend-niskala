import { axiosWrapper } from "./axiosWrapper";

// API Endpoints

// Auth Endpoints
export const login = (data) => axiosWrapper.post("/api/user/login", data);
export const register = (data) => axiosWrapper.post("/api/user/register", data);
export const getUserData = () => axiosWrapper.get("/api/user");
export const logout = () => axiosWrapper.post("/api/user/logout");

// Category Endpoints
export const addCategory = (data) => axiosWrapper.post("/api/category/", data);
export const getCategories = (params = {}) =>
  axiosWrapper.get("/api/category", { params });
export const updateCategory = ({ categoryId, ...categoryData }) =>
  axiosWrapper.put(`/api/category/${categoryId}`, categoryData);
export const deleteCategory = (categoryId) =>
  axiosWrapper.delete(`/api/category/${categoryId}`);

// Menu Item Endpoints
export const addMenuItem = (data) => axiosWrapper.post("/api/menu-item/", data);
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

// Add-on Endpoints
export const addAddOn = (data) => axiosWrapper.post("/api/add-on/", data);
export const getAddOns = (categoryId) =>
  axiosWrapper.get("/api/add-on", { params: { categoryId } });
export const updateAddOn = ({ addOnId, ...addOnData }) =>
  axiosWrapper.put(`/api/add-on/${addOnId}`, addOnData);
export const deleteAddOn = (addOnId) => axiosWrapper.delete(`/api/add-on/${addOnId}`);

// Payment Endpoints
export const createMidtransTransaction = (data) =>
  axiosWrapper.post("/api/payment/create-order", data);
export const verifyMidtransPayment = (data) =>
  axiosWrapper.post("/api/payment/verify-payment", data);

// Order Endpoints
export const addOrder = (data) => axiosWrapper.post("/api/order/", data);
export const getOrders = () => axiosWrapper.get("/api/order");
export const updateOrderStatus = ({ orderId, orderStatus }) =>
  axiosWrapper.put(`/api/order/${orderId}`, { orderStatus });
export const updateCateringPaymentStatus = ({ orderId, isPaid }) =>
  axiosWrapper.put(`/api/order/${orderId}/catering-payment`, { isPaid });
export const addCateringPayment = ({ orderId, amount }) =>
  axiosWrapper.patch(`/api/order/${orderId}/catering-payment/add`, { amount });

// Stock Item Endpoints
export const addStockItem = (data) => axiosWrapper.post("/api/stock-item/", data);
export const getStockItems = () => axiosWrapper.get("/api/stock-item");
export const updateStockItem = ({ stockItemId, ...stockItemData }) =>
  axiosWrapper.put(`/api/stock-item/${stockItemId}`, stockItemData);
export const updateStockQuantity = ({ stockItemId, stock }) =>
  axiosWrapper.patch(`/api/stock-item/${stockItemId}/stock`, { stock });
export const deleteStockItem = (stockItemId) =>
  axiosWrapper.delete(`/api/stock-item/${stockItemId}`);
