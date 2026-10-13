import { createSlice } from "@reduxjs/toolkit";

const initialState = [];

const getItemPrice = (item) => item.pricePerQuantity * item.quantity;
const getAddOnTotal = (item) =>
  (item.addOns || []).reduce((total, addOn) => total + (Number(addOn.price) || 0), 0);
const getVariantText = (item) =>
  [item.sizeVariant, item.temperatureVariant].filter(Boolean).join(" / ") ||
  item.variant ||
  null;
const syncItemBasePrice = (existingItem, nextItem) => {
  existingItem.taxRate = nextItem.taxRate ?? existingItem.taxRate ?? null;
  existingItem.sizePrices = nextItem.sizePrices ?? existingItem.sizePrices ?? null;
  existingItem.originalSizePrices =
    nextItem.originalSizePrices ?? existingItem.originalSizePrices ?? null;
  existingItem.temperatureOptions =
    nextItem.temperatureOptions ?? existingItem.temperatureOptions ?? null;
  existingItem.sizeVariant =
    existingItem.sizeVariant ?? nextItem.sizeVariant ?? nextItem.variant ?? null;
  existingItem.temperatureVariant =
    existingItem.temperatureVariant ?? nextItem.temperatureVariant ?? null;

  const selectedVariant = existingItem.sizeVariant ?? nextItem.sizeVariant;
  const nextBasePrice =
    nextItem.sizePrices?.[selectedVariant] ?? nextItem.basePrice;

  if (!nextBasePrice || existingItem.basePrice === nextBasePrice) {
    existingItem.variant = getVariantText(existingItem);
    return;
  }

  existingItem.basePrice = nextBasePrice;
  existingItem.originalPrice =
    nextItem.originalSizePrices?.[selectedVariant] ?? nextItem.originalPrice;
  existingItem.pricePerQuantity = nextBasePrice + getAddOnTotal(existingItem);
  existingItem.variant = getVariantText(existingItem);
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
        variant: getVariantText(item),
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
        variant: getVariantText(item),
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

      existingItem.sizeVariant = variant;

      const nextBasePrice = existingItem.sizePrices?.[variant];
      if (nextBasePrice === undefined) return;

      existingItem.basePrice = nextBasePrice;
      existingItem.originalPrice =
        existingItem.originalSizePrices?.[variant] ?? existingItem.originalPrice;
      existingItem.pricePerQuantity = nextBasePrice + getAddOnTotal(existingItem);
      existingItem.price = getItemPrice(existingItem);
      existingItem.variant = getVariantText(existingItem);
    },

    updateItemTemperature: (state, action) => {
      const { id, temperature } = action.payload;
      const existingItem = state.find((item) => item.id === id);

      if (!existingItem) return;

      existingItem.temperatureVariant = temperature;
      existingItem.variant = getVariantText(existingItem);
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
  updateItemTemperature,
  removeAllItems,
} =
  cartSlice.actions;
export default cartSlice.reducer;
