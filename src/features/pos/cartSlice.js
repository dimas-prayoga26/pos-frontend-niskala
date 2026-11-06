import { createSlice } from "@reduxjs/toolkit";
import { pickedBundleChoices } from "./utils/bundleChoices";

const initialState = [];

// A promo with a discount (discountPercent, 0-100) takes the percent off the
// line, rounded to whole rupiah.
const clampDiscount = (value) => Math.min(Math.max(Number(value) || 0, 0), 100);
const getItemPrice = (item) => {
  const listPrice = item.pricePerQuantity * item.quantity;
  const discountPercent = clampDiscount(item.discountPercent);

  return discountPercent ? Math.round((listPrice * (100 - discountPercent)) / 100) : listPrice;
};
const getAddOnTotal = (item) =>
  (item.addOns || []).reduce((total, addOn) => total + (Number(addOn.price) || 0), 0);
// Re-adding an item picks up its current tax and price (e.g. after switching
// between offline and online pricing).
const syncItemBasePrice = (existingItem, nextItem) => {
  existingItem.taxRate = nextItem.taxRate ?? existingItem.taxRate ?? null;

  const nextBasePrice = nextItem.basePrice;
  if (!nextBasePrice || existingItem.basePrice === nextBasePrice) return;

  existingItem.basePrice = nextBasePrice;
  existingItem.originalPrice = nextItem.originalPrice;
  existingItem.pricePerQuantity = nextBasePrice + getAddOnTotal(existingItem);
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
        price: getItemPrice({ ...item, quantity }),
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
        price: getItemPrice({ ...item, quantity: parsedQuantity }),
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

    // Picks the menu of one portion of a package's choice on a cart line.
    pickBundleChoice: (state, action) => {
      const { id, slotIndex, pickIndex, menuItemId } = action.payload;
      const line = state.find((item) => item.id === id);
      const slot = line?.bundleSlots?.[slotIndex];

      if (!slot || pickIndex < 0 || pickIndex >= slot.picks.length) return;

      slot.picks[pickIndex] = Number(menuItemId) || null;
      line.bundleChoices = pickedBundleChoices(line.bundleSlots);
    },

    removeAllItems: () => {
      return [];
    },
  },
});

export const getTotalPrice = (state) =>
  state.cart.reduce((total, item) => total + item.price, 0);
// Rupiah taken off by discount promos (shown only; never counted as income).
export const getTotalDiscount = (state) =>
  state.cart.reduce(
    (total, item) =>
      total + Math.max(item.pricePerQuantity * item.quantity - item.price, 0),
    0
  );
export const {
  addItems,
  decreaseItem,
  removeItem,
  setItemQuantity,
  pickBundleChoice,
  updateItemCustomization,
  removeAllItems,
} =
  cartSlice.actions;
export default cartSlice.reducer;
