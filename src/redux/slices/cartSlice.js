import { createSlice } from "@reduxjs/toolkit";

const initialState = [];

const getItemPrice = (item) => item.pricePerQuantity * item.quantity;

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addItems: (state, action) => {
      const item = action.payload;
      const quantity = item.quantity || 1;
      const existingItem = state.find((cartItem) => cartItem.id === item.id);

      if (existingItem) {
        existingItem.quantity += quantity;
        existingItem.price = getItemPrice(existingItem);
        return;
      }

      state.push({
        ...item,
        quantity,
        price: item.pricePerQuantity * quantity,
      });
    },

    decreaseItem: (state, action) => {
      const existingItem = state.find((item) => item.id === action.payload);

      if (!existingItem) return;

      if (existingItem.quantity <= 1) {
        return state.filter((item) => item.id !== action.payload);
      }

      existingItem.quantity -= 1;
      existingItem.price = getItemPrice(existingItem);
    },

    removeItem: (state, action) => {
      return state.filter((item) => item.id !== action.payload);
    },

    updateItemCustomization: (state, action) => {
      const { id, addOns = [] } = action.payload;
      const existingItem = state.find((item) => item.id === id);

      if (!existingItem) return;

      const basePrice = existingItem.basePrice || existingItem.pricePerQuantity;
      const addOnTotal = addOns.reduce((total, addOn) => total + addOn.price, 0);

      existingItem.basePrice = basePrice;
      existingItem.addOns = addOns;
      existingItem.pricePerQuantity = basePrice + addOnTotal;
      existingItem.price = getItemPrice(existingItem);
    },

    updateItemVariant: (state, action) => {
      const { id, variant } = action.payload;
      const existingItem = state.find((item) => item.id === id);

      if (!existingItem) return;

      existingItem.variant = variant;
    },

    removeAllItems: () => {
      return [];
    },
  },
});

export const getTotalPrice = (state) =>
  state.cart.reduce((total, item) => total + item.price, 0);
export const {
  addItems,
  decreaseItem,
  removeItem,
  updateItemCustomization,
  updateItemVariant,
  removeAllItems,
} =
  cartSlice.actions;
export default cartSlice.reducer;
