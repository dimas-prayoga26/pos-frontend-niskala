import { configureStore } from "@reduxjs/toolkit";
import customerSlice from "../redux/slices/customerSlice";
import cartSlice from "../features/pos/cartSlice";
import { userReducer as userSlice } from "../features/auth";

const store = configureStore({
    reducer: {
        customer: customerSlice,
        cart : cartSlice,
        user : userSlice
    },

    devTools: import.meta.env.NODE_ENV !== "production",
});

export default store;
