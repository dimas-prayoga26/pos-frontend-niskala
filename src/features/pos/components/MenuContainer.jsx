import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useDispatch, useSelector } from "react-redux";
import { setCustomer } from "../../../redux/slices/customerSlice";
import { getCategories, getMenuItems } from "../api";
import { addItems, decreaseItem, setItemQuantity } from "../cartSlice";
import { buildMenuCatalog } from "../utils/menuCatalog";
import { buildCartItem, getCartItemId, getItemUnitPrice } from "../utils/menuPricing";
import CategorySelector from "./CategorySelector";
import MenuItemCard from "./MenuItemCard";

const MAX_QUANTITY = 999;

const MenuContainer = () => {
  const [selected, setSelected] = useState(null);
  const cartData = useSelector((state) => state.cart);
  const orderType = useSelector((state) => state.customer.orderType || "Offline");
  const dispatch = useDispatch();
  const isOnlineOrder = orderType === "Online";

  const { data: categoriesRes } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
    placeholderData: keepPreviousData,
  });

  const { data: menuItemsRes } = useQuery({
    queryKey: ["menu-items"],
    queryFn: () => getMenuItems(),
    placeholderData: keepPreviousData,
  });

  const menuData = useMemo(
    () =>
      buildMenuCatalog(
        categoriesRes?.data?.data || [],
        menuItemsRes?.data?.data || [],
        isOnlineOrder
      ),
    [categoriesRes, isOnlineOrder, menuItemsRes]
  );

  // Keep the selected category when the catalog refreshes; default to the first.
  useEffect(() => {
    if (!menuData.length) return;

    setSelected((current) => {
      return menuData.find((menu) => menu.id === current?.id) || menuData[0];
    });
  }, [menuData]);

  useEffect(() => {
    if (!selected?.name) return;

    dispatch(setCustomer({ selectedCategoryName: selected.name }));
  }, [dispatch, selected?.name]);

  const getItemQuantity = (id) =>
    cartData.find((item) => item.id === id)?.quantity || 0;

  const toCartItem = (item) =>
    buildCartItem(item, { category: selected, isOnlineOrder });

  return (
    <>
      <CategorySelector categories={menuData} selected={selected} onSelect={setSelected} />

      <hr className="border-[#2a2a2a] border-t-2 mt-4" />

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4 px-4 md:px-10 py-4 w-full">
        {selected?.items.map((item) => {
          const cartItemId = getCartItemId(item, selected);

          return (
            <MenuItemCard
              key={item.id}
              item={item}
              price={getItemUnitPrice(item, isOnlineOrder)}
              quantity={getItemQuantity(cartItemId)}
              onIncrement={() => dispatch(addItems({ ...toCartItem(item), quantity: 1 }))}
              onDecrement={() => dispatch(decreaseItem(cartItemId))}
              onQuantityChange={(value) =>
                dispatch(
                  setItemQuantity({
                    item: toCartItem(item),
                    quantity: Math.min(Math.max(Number(value) || 0, 0), MAX_QUANTITY),
                  })
                )
              }
            />
          );
        })}
        {selected && selected.items.length === 0 && (
          <div className="col-span-full rounded-lg border border-[#333] bg-[#1a1a1a] p-6 text-center text-sm font-semibold text-[#ababab]">
            Belum ada menu tersedia di category ini.
          </div>
        )}
      </div>
    </>
  );
};

export default MenuContainer;
