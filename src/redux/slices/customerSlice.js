import { createSlice } from "@reduxjs/toolkit";
import { getJakartaDateKey } from "../../utils";

const getToday = () => getJakartaDateKey();

const initialState = {
    customerName: "",
    customerNameSource: null,
    customerPhone: "",
    orderType: "Offline",
    orderPlatformId: null,
    orderPlatform: "",
    platformTax: 0,
    orderDate: getToday(),
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
                phone,
                orderType,
                orderPlatformId,
                orderPlatform,
                platformTax,
                orderDate,
                selectedCategoryName,
                note,
                catering
            } = action.payload;
            const phoneChanged = phone != null && phone.trim() !== state.customerPhone.trim();
            if (phoneChanged || (orderType && orderType !== state.orderType)) {
                if (["lookup", "voucher", "suggestion"].includes(state.customerNameSource)) state.customerName = "";
                if (!state.customerName) state.customerNameSource = null;
            }
            if (name != null) {
                state.customerName = name;
                state.customerNameSource = action.payload.nameSource ?? "manual";
            }
            state.customerPhone = phone ?? state.customerPhone;
            state.orderType = orderType ?? state.orderType;
            if (Object.prototype.hasOwnProperty.call(action.payload, "orderPlatformId")) {
                state.orderPlatformId = orderPlatformId;
            }
            state.orderPlatform = orderPlatform ?? state.orderPlatform;
            state.platformTax = platformTax ?? state.platformTax;
            state.orderDate = orderDate ?? state.orderDate;
            if (orderType === "Online" && !state.orderDate) {
                state.orderDate = getToday();
            }
            state.selectedCategoryName = selectedCategoryName ?? state.selectedCategoryName;
            state.note = note ?? state.note;
            state.catering = catering
                ? { ...state.catering, ...catering }
                : state.catering;
        },

        fillCustomerName: (state, { payload: { phone, name } }) => {
            if (state.orderType !== "Offline" || state.customerPhone.trim() !== phone) return;
            if (state.customerNameSource !== "lookup" && (state.customerNameSource || state.customerName)) return;
            state.customerName = name;
            state.customerNameSource = "lookup";
        },

        removeCustomer: (state) => {
            state.customerName = "";
            state.customerNameSource = null;
            state.customerPhone = "";
            state.orderType = "Offline";
            state.orderPlatformId = null;
            state.orderPlatform = "";
            state.platformTax = 0;
            state.orderDate = getToday();
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


export const { setCustomer, fillCustomerName, removeCustomer } = customerSlice.actions;
export default customerSlice.reducer;
