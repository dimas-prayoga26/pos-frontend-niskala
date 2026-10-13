import { describe, expect, it } from "vitest";
import cartReducer, {
  addItems,
  decreaseItem,
  getTotalPrice,
  removeAllItems,
  removeItem,
  setItemQuantity,
  updateItemCustomization,
  updateItemTemperature,
  updateItemVariant,
} from "../../src/features/pos/cartSlice";
import customerReducer, { removeCustomer, setCustomer } from "../../src/redux/slices/customerSlice";
import { removeUser, setUser, userReducer } from "../../src/features/auth";
import { getJakartaDateKey } from "../../src/utils";

const coffee = {
  id: "3-7",
  sourceMenuItemId: 7,
  name: "Kopi Uji",
  basePrice: 20000,
  pricePerQuantity: 20000,
  sizePrices: { Regular: 20000, Large: 26000 },
  originalSizePrices: { Regular: 20000, Large: 26000 },
  sizeVariant: "Regular",
  addOns: [],
};

const reduce = (reducer, actions, state) => actions.reduce(reducer, state);

describe("cart slice", () => {
  it("adds items, merges duplicates and keeps the line total", () => {
    const state = reduce(cartReducer, [addItems(coffee), addItems({ ...coffee, quantity: 2 })], []);
    expect(state).toHaveLength(1);
    expect(state[0]).toMatchObject({ quantity: 3, price: 60000, variant: "Regular" });
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

  it("reprices on size change and add-ons, and labels the variant", () => {
    let state = cartReducer([], addItems(coffee));
    state = cartReducer(state, updateItemVariant({ id: "3-7", variant: "Large" }));
    expect(state[0]).toMatchObject({ basePrice: 26000, pricePerQuantity: 26000, price: 26000 });
    state = cartReducer(state, updateItemCustomization({ id: "3-7", addOns: [{ price: 3000 }, { price: "2000" }] }));
    expect(state[0]).toMatchObject({ pricePerQuantity: 31000, price: 31000 });
    state = cartReducer(state, updateItemTemperature({ id: "3-7", temperature: "Ice" }));
    expect(state[0].variant).toBe("Large / Ice");
  });
});

describe("customer slice", () => {
  it("merges partial updates and keeps omitted fields", () => {
    const initial = customerReducer(undefined, { type: "init" });
    expect(initial).toMatchObject({ orderType: "Offline", guests: 1, orderDate: getJakartaDateKey() });

    let state = customerReducer(initial, setCustomer({ name: "Budi", guests: 3 }));
    expect(state).toMatchObject({ customerName: "Budi", guests: 3, orderPlatformId: null });

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
