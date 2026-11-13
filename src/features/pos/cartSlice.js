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
// Bahan olahan swapped on the line (Nasi Daun Jeruk for Nasi Putih) add their
// extra price to every portion, like add-ons.
const getSwapTotal = (item) =>
  (item.ingredientSwaps || []).reduce((total, swap) => total + (Number(swap.extraPrice) || 0), 0);
const getExtrasTotal = (item) => getAddOnTotal(item) + getSwapTotal(item);
// Re-adding an item picks up its current tax and price (e.g. after switching
// between offline and online pricing).
const syncItemBasePrice = (existingItem, nextItem) => {
  existingItem.taxRate = nextItem.taxRate ?? existingItem.taxRate ?? null;

  const nextBasePrice = nextItem.basePrice;
  if (!nextBasePrice || existingItem.basePrice === nextBasePrice) return;

  existingItem.basePrice = nextBasePrice;
  existingItem.originalPrice = nextItem.originalPrice;
  existingItem.pricePerQuantity = nextBasePrice + getExtrasTotal(existingItem);
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

      existingItem.basePrice = basePrice;
      existingItem.addOns = addOns;
      existingItem.pricePerQuantity = basePrice + getExtrasTotal(existingItem);
      existingItem.price = getItemPrice(existingItem);
    },

    // Swaps a bahan olahan of a line for one of its options (toSemiItemId
    // empty: back to the menu's own). The line becomes "<menu line>~swap-<ids>",
    // so the menu card keeps adding plain portions and one order can hold
    // both; it joins a line with the same swaps.
    swapIngredient: (state, action) => {
      const { id, fromSemiItemId, toSemiItemId } = action.payload;
      const index = state.findIndex((item) => item.id === id);
      const line = state[index];
      const choice = line?.ingredientChoices?.find(
        (candidate) => Number(candidate.semiItemId) === Number(fromSemiItemId)
      );
      if (!choice) return;

      const option = choice.options.find((candidate) => Number(candidate.semiItemId) === Number(toSemiItemId));
      const swaps = (line.ingredientSwaps || []).filter(
        (swap) => Number(swap.fromSemiItemId) !== Number(fromSemiItemId)
      );
      if (option) {
        swaps.push({
          fromSemiItemId: choice.semiItemId,
          toSemiItemId: option.semiItemId,
          fromName: choice.name,
          toName: option.name,
          extraPrice: Number(option.extraPrice) || 0,
        });
      }

      const baseId = String(line.id).split("~swap-")[0];
      const nextId = swaps.length
        ? `${baseId}~swap-${swaps.map((swap) => swap.toSemiItemId).sort((a, b) => a - b).join(".")}`
        : baseId;
      const basePrice = line.basePrice || line.pricePerQuantity - getExtrasTotal(line);
      const twin = state.find((item) => item.id === nextId && item !== line);

      if (twin) {
        twin.quantity += line.quantity;
        twin.price = getItemPrice(twin);
        state.splice(index, 1);
        return;
      }

      line.id = nextId;
      line.ingredientSwaps = swaps;
      line.basePrice = basePrice;
      line.pricePerQuantity = basePrice + getExtrasTotal(line);
      line.price = getItemPrice(line);
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
  swapIngredient,
  updateItemCustomization,
  removeAllItems,
} =
  cartSlice.actions;
export default cartSlice.reducer;
