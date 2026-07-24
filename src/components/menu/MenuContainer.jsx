import React, { useEffect, useMemo, useState } from "react";
import { GrRadialSelected } from "react-icons/gr";
import { MdKeyboardArrowDown } from "react-icons/md";
import { useDispatch, useSelector } from "react-redux";
import {
  addItems,
  decreaseItem,
  setItemQuantity,
} from "../../redux/slices/cartSlice";
import { setCustomer } from "../../redux/slices/customerSlice";
import { formatCurrency } from "../../utils";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getAddOns, getCategories, getMenuItems } from "../../https";
import butterChicken from "../../assets/images/butter-chicken-4.jpg";
import palakPaneer from "../../assets/images/Saag-Paneer-1.jpg";
import biryani from "../../assets/images/hyderabadibiryani.jpg";
import masalaDosa from "../../assets/images/masala-dosa.jpg";
import choleBhature from "../../assets/images/chole-bhature.jpg";
import rajmaChawal from "../../assets/images/rajma-chawal-1.jpg";
import paneerTikka from "../../assets/images/paneer-tika.webp";
import gulabJamun from "../../assets/images/gulab-jamun.webp";
import pooriSabji from "../../assets/images/poori-sabji.webp";
import roganJosh from "../../assets/images/rogan-josh.jpg";
import noImage from "../../assets/no-image.svg";

const menuItemImages = {
  "Butter Chicken": butterChicken,
  "Paneer Butter Masala": palakPaneer,
  "Chicken Biryani": biryani,
  "Dal Makhani": rajmaChawal,
  "Kadai Paneer": paneerTikka,
  "Rogan Josh": roganJosh,
  "Paneer Tikka": paneerTikka,
  "Chicken Tikka": butterChicken,
  "Tandoori Chicken": butterChicken,
  Samosa: pooriSabji,
  "Aloo Tikki": pooriSabji,
  "Hara Bhara Kebab": paneerTikka,
  "Gulab Jamun": gulabJamun,
  Kulfi: gulabJamun,
  "Chocolate Lava Cake": gulabJamun,
  "Ras Malai": gulabJamun,
  "Margherita Pizza": masalaDosa,
  "Veg Supreme Pizza": masalaDosa,
  "Pepperoni Pizza": butterChicken,
  "Chole Bhature": choleBhature,
};

const fallbackImages = [
  butterChicken,
  palakPaneer,
  biryani,
  paneerTikka,
  gulabJamun,
  pooriSabji,
  roganJosh,
  masalaDosa,
];

const categoryColors = [
  "#b73e3e",
  "#5b45b0",
  "#7f167f",
  "#735f32",
  "#1d2569",
  "#285430",
];

const CategoryLabel = ({ menu }) => (
  <span className="inline-flex items-center gap-2">
    {menu?.icon ? (
      <span className="shrink-0">{menu.icon}</span>
    ) : null}
    <span>{menu?.name}</span>
  </span>
);

const categoryIcons = {
  Coffee: "☕",
  "Non-Coffee": "🥤",
  "Main Course": "🍚",
  Snack: "🍟",
  Catering: "🍱",
};

const defaultSizeName = "Reguler";
const backendBaseUrl = import.meta.env.VITE_BACKEND_URL || "";

const MenuContainer = () => {
  const [selected, setSelected] = useState(null);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [selectedSizeByItem, setSelectedSizeByItem] = useState({});
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

  const { data: addOnsRes } = useQuery({
    queryKey: ["add-ons"],
    queryFn: () => getAddOns(),
    placeholderData: keepPreviousData,
  });

  const menuData = useMemo(() => {
    const categories = categoriesRes?.data?.data || [];
    const menuItems = menuItemsRes?.data?.data || [];
    const addOns = addOnsRes?.data?.data || [];
    const addOnsCategory = categories.find(
      (category) => category.name === "Add Ons"
    );

    const regularMenus =
      categories.length && menuItems.length
        ? categories
            .map((category) => ({
              id: category.id || category._id,
              name: category.name,
              icon: category.icon || categoryIcons[category.name] || "",
              taxRate: category.taxRate ?? category.tax ?? null,
              items: menuItems
                .filter(
                  (item) =>
                    Number(item.categoryId) ===
                    Number(category.id || category._id)
                )
                .map((item) => ({
                  id: item.id || item._id,
                  name: item.name,
                  price: item.price,
                  regularPrice: item.regularPrice ?? item.price,
                  largePrice: item.largePrice,
                  variants: item.variants || [],
                  sizes: item.sizes || [],
                  imagePath: item.imagePath || null,
                  taxRate:
                    item.category?.taxRate ??
                    item.category?.tax ??
                    category.taxRate ??
                    category.tax ??
                    null,
                })),
            }))
            .filter((menu) => menu.items.length > 0)
        : [];

    const addOnMenu = addOns.length
      ? [
          {
            id: "add-ons",
            name: "Add Ons",
            icon: addOnsCategory?.icon || "",
            items: addOns.map((addOn) => ({
              id: addOn.id || addOn._id || addOn.code,
              name: addOn.name,
              price: addOn.price,
              imagePath: addOn.imagePath || null,
            })),
          },
        ]
      : [];

    return [...regularMenus, ...addOnMenu];
  }, [addOnsRes, categoriesRes, menuItemsRes]);

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

  const getSelectedSizeName = (item) => {
    const sizes = item.sizes || [];
    return selectedSizeByItem[item.id] || sizes[0]?.name || defaultSizeName;
  };

  const getCartItemId = (item) => {
    const selectedSize = getSelectedSizeName(item);
    const hasSizes = (item.sizes || []).length > 0;

    return `${selected.id}-${item.id}${hasSizes ? `-${selectedSize}` : ""}`;
  };

  const getItemQuantity = (id) =>
    cartData.find((item) => item.id === id)?.quantity || 0;

  const getMenuPrice = (price) => {
    const basePrice = Number(price) || 0;
    return isOnlineOrder ? Math.round(basePrice * 1.2) : basePrice;
  };

  const getBaseItemPrice = (item) => item.sizes?.[0]?.price ?? item.price;

  const getOriginalSizePrices = (item) => {
    if (item.sizes?.length > 1) {
      return item.sizes.reduce((prices, size) => {
        prices[size.name] = Number(size.price) || 0;
        return prices;
      }, {});
    }

    const largePrice = Number(item.largePrice) || 0;
    if (!largePrice) return null;

    return {
      Reguler: Number(item.regularPrice ?? item.price) || 0,
      Large: largePrice,
    };
  };

  const getSizePrices = (item) => {
    const originalSizePrices = getOriginalSizePrices(item);

    if (!originalSizePrices) return null;

    return {
      Reguler: getMenuPrice(originalSizePrices.Reguler),
      Large: getMenuPrice(originalSizePrices.Large),
    };
  };

  const getDefaultMenuPrice = (item) =>
    getSizePrices(item)?.[getSelectedSizeName(item)] ??
    getMenuPrice(getBaseItemPrice(item));

  const increment = (item) => {
    const cartItemId = getCartItemId(item);
    const originalSizePrices = getOriginalSizePrices(item);
    const sizePrices = getSizePrices(item);
    const selectedSize = getSelectedSizeName(item);
    const menuPrice =
      sizePrices?.[selectedSize] ?? getMenuPrice(getBaseItemPrice(item));

    dispatch(
      addItems({
        id: cartItemId,
        menuItemId: cartItemId,
        name: item.name,
        categoryName: selected.name,
        taxRate: item.taxRate ?? selected.taxRate ?? null,
        basePrice: menuPrice,
        originalPrice: originalSizePrices?.[selectedSize] ?? getBaseItemPrice(item),
        originalSizePrices,
        sizePrices,
        sizeVariant: sizePrices ? selectedSize : null,
        temperatureOptions: item.variants?.length ? item.variants : null,
        addOns: [],
        pricePerQuantity: menuPrice,
        quantity: 1,
      })
    );
  };

  const buildCartItem = (item) => {
    const cartItemId = getCartItemId(item);
    const originalSizePrices = getOriginalSizePrices(item);
    const sizePrices = getSizePrices(item);
    const selectedSize = getSelectedSizeName(item);
    const menuPrice =
      sizePrices?.[selectedSize] ?? getMenuPrice(getBaseItemPrice(item));

    return {
      id: cartItemId,
      menuItemId: cartItemId,
      name: item.name,
      categoryName: selected.name,
      taxRate: item.taxRate ?? selected.taxRate ?? null,
      basePrice: menuPrice,
      originalPrice: originalSizePrices?.[selectedSize] ?? getBaseItemPrice(item),
      originalSizePrices,
      sizePrices,
      sizeVariant: sizePrices ? selectedSize : null,
      temperatureOptions: item.variants?.length ? item.variants : null,
      addOns: [],
      pricePerQuantity: menuPrice,
    };
  };

  const updateQuantity = (item, value) => {
    const quantity = Math.min(Math.max(Number(value) || 0, 0), 999);

    dispatch(
      setItemQuantity({
        item: buildCartItem(item),
        quantity,
      })
    );
  };

  const decrement = (id) => {
    dispatch(decreaseItem(id));
  };

  const getItemImage = (item, index) => {
    if (item.imagePath?.startsWith("/uploads/")) {
      return `${backendBaseUrl}${item.imagePath}`;
    }

    return item.imagePath || noImage;
  };

  const selectItemSize = (item, sizeName) => {
    setSelectedSizeByItem((current) => ({
      ...current,
      [item.id]: sizeName,
    }));
  };

  const selectedIndex = Math.max(
    menuData.findIndex((menu) => menu.id === selected?.id),
    0
  );
  const selectedColor = categoryColors[selectedIndex % categoryColors.length];

  const handleCategorySelect = (nextCategory) => {
    setSelected(nextCategory);
    setIsCategoryOpen(false);
  };

  const renderQuantityControls = (item, cartItemId, quantity) => (
    <div className="flex items-center justify-between bg-[#1f1f1f] px-2 py-2 rounded-lg gap-2 min-w-[88px] sm:min-w-[130px] sm:px-4 sm:py-3 sm:gap-4">
      <button
        onClick={() => decrement(cartItemId)}
        className="text-[#a79981] text-xl sm:text-2xl"
      >
        &minus;
      </button>
      <input
        type="number"
        min="0"
        max="999"
        value={quantity}
        onChange={(event) => updateQuantity(item, event.target.value)}
        onFocus={(event) => event.target.select()}
        className="h-8 w-10 rounded-md bg-[#262626] text-center text-sm font-semibold text-white outline-none [appearance:textfield] sm:w-12 sm:text-base [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        onClick={() => increment(item)}
        className="text-[#a79981] text-xl sm:text-2xl"
      >
        &#43;
      </button>
    </div>
  );

  return (
    <>
      <div className="sticky top-0 z-30 bg-[#1f1f1f] px-4 py-4 md:px-10 sm:hidden">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsCategoryOpen((current) => !current)}
            className="flex min-h-[94px] w-full items-center justify-between rounded-lg px-4 py-4 text-left shadow-[0_10px_26px_rgba(0,0,0,0.2)]"
            style={{ backgroundColor: selectedColor }}
          >
            <span>
              <span className="block text-lg font-semibold text-[#f5f5f5]">
                <CategoryLabel menu={selected} />
              </span>
              <span className="mt-4 block text-sm font-semibold text-[#d0d0d0]">
                {selected?.items?.length || 0} Items
              </span>
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white">
              <MdKeyboardArrowDown
                size={26}
                className={`transition-transform ${
                  isCategoryOpen ? "rotate-180" : ""
                }`}
              />
            </span>
          </button>

          {isCategoryOpen && (
            <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-20 overflow-hidden rounded-lg border border-[#2f2f2f] bg-[#181818] shadow-[0_18px_42px_rgba(0,0,0,0.42)]">
              {menuData.map((menu, index) => (
                <button
                  key={menu.id}
                  type="button"
                  onClick={() => handleCategorySelect(menu)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[#242424]"
                >
                  <span>
                    <span className="block text-base font-semibold text-[#f5f5f5]">
                      <CategoryLabel menu={menu} />
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-[#ababab]">
                      {menu.items.length} Items
                    </span>
                  </span>
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{
                      backgroundColor:
                        categoryColors[index % categoryColors.length],
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 px-4 md:px-10 py-4 w-full">
        {menuData.map((menu, index) => {
          return (
            <div
              key={menu.id}
              className="flex flex-col items-start justify-between p-4 rounded-lg min-h-[100px] cursor-pointer"
              style={{ backgroundColor: categoryColors[index % categoryColors.length] }}
              onClick={() => setSelected(menu)}
            >
              <div className="flex items-center justify-between w-full">
                <h1 className="text-[#f5f5f5] text-lg font-semibold">
                  <CategoryLabel menu={menu} />
                </h1>
                {selected?.id === menu.id && (
                  <GrRadialSelected className="text-white" size={20} />
                )}
              </div>
              <p className="text-[#ababab] text-sm font-semibold">
                {menu.items.length} Items
              </p>
            </div>
          );
        })}
      </div>

      <hr className="border-[#2a2a2a] border-t-2 mt-4" />

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4 px-4 md:px-10 py-4 w-full">
        {selected?.items.map((item, index) => {
          const cartItemId = getCartItemId(item);
          const quantity = getItemQuantity(cartItemId);
          const itemImage = getItemImage(item, index);
          const sizePrices = getSizePrices(item);
          const selectedSizeName = getSelectedSizeName(item);

          return (
            <div
              key={item.id}
              className="flex min-h-[210px] flex-col justify-between rounded-lg bg-[#1a1a1a] p-3 hover:bg-[#2a2a2a] sm:min-h-[260px] sm:p-4"
            >
              <div>
                <div className={sizePrices ? "min-h-[64px] sm:min-h-[72px]" : ""}>
                  <h1 className="text-sm font-semibold leading-tight text-[#f5f5f5] sm:text-lg">
                    {item.name}
                  </h1>
                  {sizePrices ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Object.keys(sizePrices).map((sizeName) => (
                        <button
                          key={sizeName}
                          type="button"
                          onClick={() => selectItemSize(item, sizeName)}
                          className={`rounded-md border px-2 py-1 text-[10px] font-bold transition sm:text-xs ${
                            selectedSizeName === sizeName
                              ? "border-[#a79981] bg-[#a79981] text-[#101010]"
                              : "border-[#303030] bg-[#222222] text-[#ababab] hover:border-[#a79981] hover:text-[#a79981]"
                          }`}
                        >
                          {sizeName}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <img
                  src={itemImage}
                  alt={item.name}
                  onError={(event) => {
                    event.currentTarget.src = noImage;
                  }}
                  className="mt-2 aspect-[4/3] w-full rounded-lg object-cover sm:mt-3 sm:aspect-[16/9]"
                />
              </div>
              <div className="mt-3 flex w-full flex-col gap-2 sm:mt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-base font-bold text-[#f5f5f5] sm:text-xl">
                  {formatCurrency(getDefaultMenuPrice(item))}
                </p>
                {renderQuantityControls(item, cartItemId, quantity)}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default MenuContainer;
