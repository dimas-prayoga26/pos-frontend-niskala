import { createSlice } from "@reduxjs/toolkit";
import { getJakartaDateKey } from "../../utils";

const getToday = () => getJakartaDateKey();

const initialState = {
    customerName: "",
    guests: 1,
    orderType: "Offline",
    orderPlatform: "",
    selectedCategoryName: "",
    catering: {
        paymentPlan: "Full",
        institution: "",
        whatsapp: "",
        orderDate: getToday(),
        eventDate: "",
        deliveryTime: "",
        dp: "",
        note: "",
    },
}


const customerSlice = createSlice({
    name : "customer",
    initialState,
    reducers : {
        setCustomer: (state, action) => {
            const { name, guests, orderType, orderPlatform, selectedCategoryName, catering } = action.payload;
            state.customerName = name ?? state.customerName;
            state.guests = guests ?? state.guests;
            state.orderType = orderType ?? state.orderType;
            state.orderPlatform = orderPlatform ?? state.orderPlatform;
            state.selectedCategoryName = selectedCategoryName ?? state.selectedCategoryName;
            state.catering = catering
                ? { ...state.catering, ...catering }
                : state.catering;
        },

        removeCustomer: (state) => {
            state.customerName = "";
            state.guests = 1;
            state.orderType = "Offline";
            state.orderPlatform = "";
            state.catering = {
                paymentPlan: "Full",
                institution: "",
                whatsapp: "",
                orderDate: getToday(),
                eventDate: "",
                deliveryTime: "",
                dp: "",
                note: "",
            };
        }

    }
})


export const { setCustomer, removeCustomer } = customerSlice.actions;
export default customerSlice.reducer;
