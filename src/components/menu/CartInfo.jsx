import React, { useEffect, useRef, useState } from "react";
import { RiDeleteBin2Fill } from "react-icons/ri";
import { useDispatch, useSelector } from "react-redux";
import {
  removeItem,
  updateItemCustomization,
  updateItemVariant,
} from "../../redux/slices/cartSlice";
import { formatCurrency } from "../../utils";

const addOnOptions = [
  { id: "nasi-putih", name: "Nasi Putih", price: 4000 },
  { id: "telur", name: "Telur", price: 5000 },
  { id: "buah", name: "Buah", price: 5000 },
  { id: "sambal", name: "Sambal", price: 4000 },
  { id: "kerupuk", name: "Kerupuk", price: 3000 },
  { id: "air-mineral", name: "Air Mineral", price: 5000 },
];

const beverageVariants = ["Hot", "Cold"];
const drinkCategories = ["Coffee", "Non-Coffee", "Beverages"];

const CartInfo = () => {
  const cartData = useSelector((state) => state.cart);
  const scrollRef = useRef();
  const dispatch = useDispatch();
  const [expandedItemId, setExpandedItemId] = useState(null);
  const [selectedAddOnByItem, setSelectedAddOnByItem] = useState({});

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [cartData.length]);

  const handleRemove = (itemId) => {
    dispatch(removeItem(itemId));
  };

  const toggleAddOnPanel = (itemId) => {
    setExpandedItemId((currentId) => (currentId === itemId ? null : itemId));
  };

  const updateSelectedAddOn = (itemId, addOnId) => {
    setSelectedAddOnByItem((current) => ({
      ...current,
      [itemId]: addOnId,
    }));
  };

  const updateCustomization = (item, addOns) => {
    dispatch(
      updateItemCustomization({
        id: item.id,
        addOns,
      })
    );
  };

  const addSelectedAddOn = (item) => {
    const selectedAddOnId = selectedAddOnByItem[item.id];
    const addOn = addOnOptions.find((option) => option.id === selectedAddOnId);

    if (!addOn) return;

    const currentAddOns = item.addOns || [];
    const alreadyAdded = currentAddOns.some(
      (currentAddOn) => currentAddOn.id === addOn.id
    );

    if (!alreadyAdded) {
      updateCustomization(item, [...currentAddOns, addOn]);
    }

    updateSelectedAddOn(item.id, "");
  };

  const removeAddOn = (item, addOnId) => {
    updateCustomization(
      item,
      (item.addOns || []).filter((addOn) => addOn.id !== addOnId)
    );
  };

  const updateVariant = (item, variant) => {
    dispatch(updateItemVariant({ id: item.id, variant }));
  };

  return (
    <div className="px-4 py-2">
      <h1 className="text-lg text-[#e4e4e4] font-semibold tracking-wide">
        Order Details
      </h1>
      <div
        className="mt-4 overflow-y-auto scrollbar-hide max-h-[320px] xl:h-[380px]"
        ref={scrollRef}
      >
        {cartData.length === 0 ? (
          <p className="text-[#ababab] text-sm flex justify-center items-center min-h-[220px] xl:h-[380px]">
            Your cart is empty. Start adding items!
          </p>
        ) : (
          cartData.map((item) => {
            const isExpanded = expandedItemId === item.id;
            const selectedAddOnId = selectedAddOnByItem[item.id] || "";
            const canUseAddOns = true;

            return (
              <div
                key={item.id}
                className="bg-[#1f1f1f] rounded-lg px-4 py-4 mb-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-[#ababab] font-semibold tracking-wide text-md">
                      {item.name}
                    </h1>
                    {item.addOns?.length > 0 && (
                      <p className="mt-1 text-xs text-[#a79981]">
                        {item.addOns.map((addOn) => addOn.name).join(", ")}
                      </p>
                    )}
                    {item.variant && (
                      <p className="mt-1 text-xs text-[#ababab]">
                        {item.variant}
                      </p>
                    )}
                  </div>
                  <p className="text-[#ababab] font-semibold">
                    x{item.quantity}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <RiDeleteBin2Fill
                      onClick={() => handleRemove(item.id)}
                      className="text-[#ababab] cursor-pointer"
                      size={20}
                    />
                    {canUseAddOns && (
                      <button
                        onClick={() => toggleAddOnPanel(item.id)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                          isExpanded || item.addOns?.length
                            ? "bg-[#a79981] text-[#101010]"
                            : "bg-[#252525] text-[#ababab] hover:text-[#a79981]"
                        }`}
                      >
                        + Add-on
                      </button>
                    )}
                  </div>
                  <p className="text-[#f5f5f5] text-md font-bold">
                    {formatCurrency(item.price)}
                  </p>
                </div>

                {drinkCategories.includes(item.categoryName) && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {beverageVariants.map((variant) => (
                      <button
                        key={variant}
                        onClick={() => updateVariant(item, variant)}
                        className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
                          item.variant === variant
                            ? "border-[#a79981] bg-[#a79981] text-[#101010]"
                            : "border-[#303030] bg-[#222222] text-[#ababab] hover:border-[#a79981] hover:text-[#a79981]"
                        }`}
                      >
                        {variant}
                      </button>
                    ))}
                  </div>
                )}

                {canUseAddOns && isExpanded && (
                  <div className="mt-3 rounded-lg border border-[#2d2d2d] bg-[#181818] p-3">
                    <p className="mb-2 text-xs font-semibold text-[#ababab]">
                      Add-ons
                    </p>
                    <div className="flex gap-2">
                      <select
                        value={selectedAddOnId}
                        onChange={(event) =>
                          updateSelectedAddOn(item.id, event.target.value)
                        }
                        className="min-w-0 flex-1 rounded-lg bg-[#252525] px-3 py-2 text-xs text-[#f5f5f5] outline-none"
                      >
                        <option value="">Select add-on</option>
                        {addOnOptions.map((addOn) => (
                          <option key={addOn.id} value={addOn.id}>
                            {addOn.name} -{" "}
                            {addOn.price ? formatCurrency(addOn.price) : "Free"}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => addSelectedAddOn(item)}
                        className="rounded-lg bg-[#a79981] px-3 py-2 text-xs font-bold text-[#101010]"
                      >
                        Add
                      </button>
                    </div>

                    <div className="mt-3 space-y-2">
                      {item.addOns?.length > 0 ? (
                        item.addOns.map((addOn) => (
                          <div
                            key={addOn.id}
                            className="flex items-center justify-between rounded-lg bg-[#222222] px-3 py-2"
                          >
                            <span className="text-xs font-semibold text-[#f5f5f5]">
                              {addOn.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-[#ababab]">
                                {addOn.price
                                  ? formatCurrency(addOn.price)
                                  : "Free"}
                              </span>
                              <button
                                onClick={() => removeAddOn(item, addOn.id)}
                                className="rounded bg-[#303030] px-2 py-1 text-xs font-bold text-[#ababab]"
                              >
                                X
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-lg bg-[#222222] px-3 py-2 text-xs text-[#777]">
                          Belum ada add-on.
                        </p>
                      )}
                    </div>

                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CartInfo;
