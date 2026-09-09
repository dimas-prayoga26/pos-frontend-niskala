import { createSlice } from "@reduxjs/toolkit";
import { getJakartaDateKey } from "../../utils";

const getToday = () => getJakartaDateKey();

const initialState = {
    customerName: "",
    guests: 1,
    orderType: "Offline",
    orderPlatformId: null,
    orderPlatform: "",
    platformTax: 0,
    selectedCategoryName: "",
    note: "",
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
            const {
                name,
                guests,
                orderType,
                orderPlatformId,
                orderPlatform,
                platformTax,
                selectedCategoryName,
                note,
                catering
            } = action.payload;
            state.customerName = name ?? state.customerName;
            state.guests = guests ?? state.guests;
            state.orderType = orderType ?? state.orderType;
            if (Object.prototype.hasOwnProperty.call(action.payload, "orderPlatformId")) {
                state.orderPlatformId = orderPlatformId;
            }
            state.orderPlatform = orderPlatform ?? state.orderPlatform;
            state.platformTax = platformTax ?? state.platformTax;
            state.selectedCategoryName = selectedCategoryName ?? state.selectedCategoryName;
            state.note = note ?? state.note;
            state.catering = catering
                ? { ...state.catering, ...catering }
                : state.catering;
        },

        removeCustomer: (state) => {
            state.customerName = "";
            state.guests = 1;
            state.orderType = "Offline";
            state.orderPlatformId = null;
            state.orderPlatform = "";
            state.platformTax = 0;
            state.note = "";
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
