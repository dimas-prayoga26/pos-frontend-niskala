import React, { useEffect, useRef } from "react";
import { FaMinus } from "react-icons/fa6";
import { RiDeleteBin2Fill } from "react-icons/ri";
import { useDispatch, useSelector } from "react-redux";
import {
  decreaseItem,
  removeItem,
  updateItemVariant,
} from "../../redux/slices/cartSlice";
import { formatCurrency } from "../../utils";

const beverageVariants = ["Hot", "Cold"];
const drinkCategories = ["Coffee", "Non-Coffee", "Beverages"];

const CartInfo = () => {
  const cartData = useSelector((state) => state.cart);
  const scrollRef = useRef();
  const dispatch = useDispatch();

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

  const handleDecreaseQuantity = (itemId) => {
    dispatch(decreaseItem(itemId));
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
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="grid h-8 w-8 place-items-center rounded-lg bg-[#252525] text-[#ababab] transition hover:text-[#a79981]"
                      aria-label={`Remove ${item.name}`}
                    >
                      <RiDeleteBin2Fill size={17} />
                    </button>
                    <button
                      onClick={() => handleDecreaseQuantity(item.id)}
                      className="grid h-8 w-8 place-items-center rounded-lg bg-[#252525] text-[#ababab] transition hover:text-[#a79981]"
                      aria-label={`Decrease ${item.name}`}
                    >
                      <FaMinus size={14} />
                    </button>
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

              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CartInfo;
