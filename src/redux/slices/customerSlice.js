import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    customerName: "",
    guests: 1,
}


const customerSlice = createSlice({
    name : "customer",
    initialState,
    reducers : {
        setCustomer: (state, action) => {
            const { name, guests } = action.payload;
            state.customerName = name;
            state.guests = guests;
        },

        removeCustomer: (state) => {
            state.customerName = "";
            state.guests = 1;
        }

    }
})


export const { setCustomer, removeCustomer } = customerSlice.actions;
export default customerSlice.reducer;
