import { createSlice } from "@reduxjs/toolkit";

const initialState = [];

const getItemPrice = (item) => item.pricePerQuantity * item.quantity;
const getAddOnTotal = (item) =>
  (item.addOns || []).reduce((total, addOn) => total + (Number(addOn.price) || 0), 0);
const syncItemBasePrice = (existingItem, nextItem) => {
  if (!nextItem.basePrice || existingItem.basePrice === nextItem.basePrice) return;

  existingItem.basePrice = nextItem.basePrice;
  existingItem.originalPrice = nextItem.originalPrice;
  existingItem.pricePerQuantity = nextItem.basePrice + getAddOnTotal(existingItem);
};

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addItems: (state, action) => {
      const item = action.payload;
      const quantity = item.quantity || 1;
      const existingItem = state.find((cartItem) => cartItem.id === item.id);

      if (existingItem) {
        syncItemBasePrice(existingItem, item);
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

    setItemQuantity: (state, action) => {
      const { item, quantity } = action.payload;
      const parsedQuantity = Math.max(Number(quantity) || 0, 0);
      const existingItem = state.find((cartItem) => cartItem.id === item.id);

      if (parsedQuantity === 0) {
        return state.filter((cartItem) => cartItem.id !== item.id);
      }

      if (existingItem) {
        syncItemBasePrice(existingItem, item);
        existingItem.quantity = parsedQuantity;
        existingItem.price = getItemPrice(existingItem);
        return;
      }

      state.push({
        ...item,
        quantity: parsedQuantity,
        price: item.pricePerQuantity * parsedQuantity,
      });
    },

    updateItemCustomization: (state, action) => {
      const { id, addOns = [] } = action.payload;
      const existingItem = state.find((item) => item.id === id);

      if (!existingItem) return;

      const basePrice = existingItem.basePrice || existingItem.pricePerQuantity;
      const addOnTotal = addOns.reduce(
        (total, addOn) => total + (Number(addOn.price) || 0),
        0
      );

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
  setItemQuantity,
  updateItemCustomization,
  updateItemVariant,
  removeAllItems,
} =
  cartSlice.actions;
export default cartSlice.reducer;
