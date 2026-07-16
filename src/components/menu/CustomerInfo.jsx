import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { setCustomer } from "../../redux/slices/customerSlice";
import { formatDate, getAvatarName } from "../../utils";

const CustomerInfo = () => {
  const dispatch = useDispatch();
  const customerData = useSelector((state) => state.customer);
  const displayCustomerName = customerData.customerName?.trim() || "Guest";

  const updateCustomer = (field, value) => {
    dispatch(
      setCustomer({
        name:
          field === "name"
            ? value
            : customerData.customerName || "",
        guests:
          field === "guests"
            ? value
            : customerData.guests || 1,
      })
    );
  };

  const incrementGuest = () => {
    updateCustomer("guests", Math.min((customerData.guests || 1) + 1, 20));
  };

  const decrementGuest = () => {
    updateCustomer("guests", Math.max((customerData.guests || 1) - 1, 1));
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-md text-[#f5f5f5] font-semibold tracking-wide">
            {displayCustomerName}
          </h1>
          <p className="text-xs text-[#ababab] font-medium mt-1">
            #New / Dine in
          </p>
          <p className="text-xs text-[#ababab] font-medium mt-2">
            {formatDate(new Date())}
          </p>
        </div>
        <button className="bg-[#a79981] p-3 text-xl font-bold rounded-lg shrink-0 text-[#101010]">
          {getAvatarName(displayCustomerName)}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label className="block text-[#ababab] mb-2 text-xs font-medium">
            Customer Name
          </label>
          <input
            value={customerData.customerName}
            onChange={(event) => updateCustomer("name", event.target.value)}
            type="text"
            placeholder="Guest"
            className="w-full rounded-lg bg-[#1f1f1f] px-4 py-3 text-sm text-white outline-none"
          />
        </div>

        <div>
          <label className="block text-[#ababab] mb-2 text-xs font-medium">
            Guest
          </label>
          <div className="flex items-center justify-between bg-[#1f1f1f] px-4 py-3 rounded-lg">
            <button onClick={decrementGuest} className="text-[#a79981] text-2xl">
              &minus;
            </button>
            <span className="text-white">{customerData.guests || 1} Person</span>
            <button onClick={incrementGuest} className="text-[#a79981] text-2xl">
              &#43;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerInfo;
