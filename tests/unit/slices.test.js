import { describe, expect, it } from "vitest";
import cartReducer, {
  addItems,
  decreaseItem,
  getTotalDiscount,
  getTotalPrice,
  pickBundleChoice,
  removeAllItems,
  removeItem,
  setItemQuantity,
  updateItemCustomization,
} from "../../src/features/pos/cartSlice";
import { hasMissingBundlePicks } from "../../src/features/pos/utils/bundleChoices";
import customerReducer, { removeCustomer, setCustomer } from "../../src/redux/slices/customerSlice";
import { removeUser, setUser, userReducer } from "../../src/features/auth";
import { getJakartaDateKey } from "../../src/utils";

const coffee = {
  id: "3-7",
  sourceMenuItemId: 7,
  name: "Kopi Uji",
  basePrice: 20000,
  pricePerQuantity: 20000,
  addOns: [],
};

const reduce = (reducer, actions, state) => actions.reduce(reducer, state);

describe("cart slice", () => {
  it("adds items, merges duplicates and keeps the line total", () => {
    const state = reduce(cartReducer, [addItems(coffee), addItems({ ...coffee, quantity: 2 })], []);
    expect(state).toHaveLength(1);
    expect(state[0]).toMatchObject({ quantity: 3, price: 60000 });
    expect(getTotalPrice({ cart: state })).toBe(60000);
  });

  it("decreases, removes and clears", () => {
    let state = reduce(cartReducer, [addItems({ ...coffee, quantity: 2 }), decreaseItem("3-7")], []);
    expect(state[0]).toMatchObject({ quantity: 1, price: 20000 });
    state = cartReducer(state, decreaseItem("3-7"));
    expect(state).toEqual([]);
    state = reduce(cartReducer, [addItems(coffee), removeItem("3-7")], []);
    expect(state).toEqual([]);
    state = reduce(cartReducer, [addItems(coffee), removeAllItems()], []);
    expect(state).toEqual([]);
  });

  it("sets an explicit quantity and drops the line at zero", () => {
    let state = cartReducer([], setItemQuantity({ item: coffee, quantity: "4" }));
    expect(state[0]).toMatchObject({ quantity: 4, price: 80000 });
    state = cartReducer(state, setItemQuantity({ item: coffee, quantity: 0 }));
    expect(state).toEqual([]);
  });

  it("reprices on add-ons and when the item is re-added at a new price", () => {
    let state = cartReducer([], addItems(coffee));
    state = cartReducer(state, updateItemCustomization({ id: "3-7", addOns: [{ price: 3000 }, { price: "2000" }] }));
    expect(state[0]).toMatchObject({ pricePerQuantity: 25000, price: 25000 });
    state = cartReducer(state, addItems({ ...coffee, basePrice: 24000, originalPrice: 20000 }));
    expect(state[0]).toMatchObject({ quantity: 2, basePrice: 24000, originalPrice: 20000, pricePerQuantity: 29000, price: 58000 });
  });
});

describe("discount promos in the cart", () => {
  it("takes the promo's percent off its price, whatever menus are picked", () => {
    const review = {
      id: "3-40~1",
      name: "Review GMaps",
      basePrice: 18000,
      pricePerQuantity: 18000,
      discountPercent: 50,
      bundleSlots: [
        {
          categoryId: 1,
          categoryName: "Coffee",
          options: [{ id: 11, name: "Kopi Susu" }],
          picks: [null],
        },
      ],
      bundleChoices: [],
    };
    let state = cartReducer([], addItems(review));
    expect(state[0].price).toBe(9000);

    state = cartReducer(state, pickBundleChoice({ id: "3-40~1", slotIndex: 0, pickIndex: 0, menuItemId: 11 }));
    expect([state[0].pricePerQuantity, state[0].price]).toEqual([18000, 9000]);

    state = cartReducer(state, addItems({ ...state[0], quantity: 1 }));
    expect([state[0].quantity, state[0].price]).toEqual([2, 18000]);
    expect(getTotalPrice({ cart: state })).toBe(18000);
    expect(getTotalDiscount({ cart: state })).toBe(18000);
  });
});

describe("package choices in the cart", () => {
  it("keeps the picked menus of a package line, counted per menu", () => {
    const paket = {
      id: "3-32~1",
      name: "Paket Ngopi",
      pricePerQuantity: 35000,
      bundleSlots: [
        {
          categoryId: 1,
          categoryName: "Coffee",
          options: [{ id: 11, name: "Kopi Susu" }, { id: 12, name: "Americano" }],
          picks: [null, null],
        },
      ],
      bundleChoices: [],
    };
    let state = cartReducer([], addItems(paket));
    expect(hasMissingBundlePicks(state)).toBe(true);

    state = cartReducer(state, pickBundleChoice({ id: "3-32~1", slotIndex: 0, pickIndex: 0, menuItemId: "11" }));
    state = cartReducer(state, pickBundleChoice({ id: "3-32~1", slotIndex: 0, pickIndex: 1, menuItemId: "11" }));
    expect(state[0].bundleChoices).toEqual([{ menuItemId: 11, name: "Kopi Susu", quantity: 2 }]);
    expect(hasMissingBundlePicks(state)).toBe(false);

    state = cartReducer(state, pickBundleChoice({ id: "3-32~1", slotIndex: 0, pickIndex: 1, menuItemId: "" }));
    expect(state[0].bundleChoices).toEqual([{ menuItemId: 11, name: "Kopi Susu", quantity: 1 }]);
    expect(hasMissingBundlePicks(state)).toBe(true);
  });
});

describe("customer slice", () => {
  it("merges partial updates and keeps omitted fields", () => {
    const initial = customerReducer(undefined, { type: "init" });
    expect(initial).toMatchObject({ orderType: "Offline", orderDate: getJakartaDateKey() });
    expect(initial).not.toHaveProperty("guests");

    let state = customerReducer(initial, setCustomer({ name: "Budi" }));
    expect(state).toMatchObject({ customerName: "Budi", orderPlatformId: null });

    state = customerReducer(state, setCustomer({ orderType: "Online", orderPlatformId: 2, orderDate: "" }));
    expect(state.orderDate).toBe(getJakartaDateKey());
    expect(state.orderPlatformId).toBe(2);

    state = customerReducer(state, setCustomer({ catering: { paymentPlan: "DP", dp: "100000" } }));
    expect(state.catering).toMatchObject({ paymentPlan: "DP", dp: "100000", institution: "" });

    state = customerReducer(state, removeCustomer());
    expect(state).toMatchObject({ customerName: "", orderType: "Offline", orderPlatformId: null });
    expect(state.catering.paymentPlan).toBe("Full");
  });
});

describe("user slice", () => {
  it("marks the session authenticated and clears it", () => {
    const user = { _id: 1, name: "Admin", email: "a@b.c", phone: "1", role: "Admin" };
    let state = userReducer(undefined, setUser(user));
    expect(state).toEqual({ ...user, isAuth: true });
    state = userReducer(state, removeUser());
    expect(state.isAuth).toBe(false);
    expect(state.role).toBe("");
  });
});
