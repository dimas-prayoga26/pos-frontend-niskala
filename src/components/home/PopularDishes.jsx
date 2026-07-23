import React, { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getMenuItems, getOrders } from "../../https";
import { formatCurrency } from "../../utils";
import noImage from "../../assets/no-image.svg";

const drinkCategories = ["Coffee", "Non-Coffee", "Beverages"];
const normalizeName = (value) => String(value || "").trim().toLowerCase();
const backendBaseUrl = import.meta.env.VITE_BACKEND_URL || "";

const resolveMenuImage = (imagePath) => {
  if (!imagePath) return noImage;
  if (imagePath.startsWith("/uploads/")) return `${backendBaseUrl}${imagePath}`;

  return imagePath;
};

const PopularDishes = () => {
  const [selectedBestSellerType, setSelectedBestSellerType] =
    useState("Makanan");
  const bestSellerTypes = ["Makanan", "Minuman"];

  const { data: ordersRes } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
    placeholderData: keepPreviousData,
  });

  const { data: menuItemsRes } = useQuery({
    queryKey: ["menu-items"],
    queryFn: () => getMenuItems(),
    placeholderData: keepPreviousData,
  });

  const orders = ordersRes?.data?.data || [];
  const menuItems = menuItemsRes?.data?.data || [];
  const menuItemByName = useMemo(() => {
    return new Map(menuItems.map((item) => [normalizeName(item.name), item]));
  }, [menuItems]);

  const bestSellingMenus = useMemo(() => {
    const salesByName = new Map();

    orders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const name = item.name;
        const normalizedName = normalizeName(name);
        const menuItem = menuItemByName.get(normalizedName);
        const categoryName = menuItem?.category?.name || "";

        if (!normalizedName || categoryName === "Catering") return;

        const type = drinkCategories.includes(categoryName)
          ? "Minuman"
          : "Makanan";
        const current = salesByName.get(normalizedName) || {
          id: menuItem?.id || item.id || normalizedName,
          image: menuItem?.imagePath,
          name,
          numberOfOrders: 0,
          type,
        };

        current.numberOfOrders += Number(item.quantity) || 0;
        current.image = current.image || menuItem?.imagePath;
        current.type = type;
        salesByName.set(normalizedName, current);
      });
    });

    return [...salesByName.values()].sort(
      (first, second) => second.numberOfOrders - first.numberOfOrders
    );
  }, [menuItemByName, orders]);

  const filteredBestSellingMenus = useMemo(
    () =>
      bestSellingMenus
        .filter((dish) => dish.type === selectedBestSellerType)
        .slice(0, 5),
    [bestSellingMenus, selectedBestSellerType]
  );
  const cateringPackages = useMemo(() => {
    const salesByName = new Map();

    orders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const normalizedName = normalizeName(item.name);
        const menuItem = menuItemByName.get(normalizedName);

        if (!normalizedName || menuItem?.category?.name !== "Catering") {
          return;
        }

        const current = salesByName.get(normalizedName) || {
          id: menuItem?.id || item.id || normalizedName,
          image: menuItem?.imagePath,
          name: item.name,
          price: menuItem?.price || item.pricePerQuantity || 0,
          numberOfOrders: 0,
        };

        current.numberOfOrders += Number(item.quantity) || 0;
        salesByName.set(normalizedName, current);
      });
    });

    const soldCateringPackages = [...salesByName.values()]
      .sort((first, second) => second.numberOfOrders - first.numberOfOrders)
      .slice(0, 3);

    if (soldCateringPackages.length) return soldCateringPackages;

    return menuItems
      .filter((item) => item.category?.name === "Catering")
      .slice(0, 3)
      .map((item) => ({
        id: item.id || item._id,
        image: item.imagePath,
        name: item.name,
        price: item.price,
        numberOfOrders: 0,
      }));
  }, [menuItemByName, menuItems, orders]);

  return (
    <div className="mt-6 flex flex-col gap-4 xl:pr-6">
      <div className="bg-[#1a1a1a] w-full rounded-lg">
        <div className="flex justify-between items-center px-6 py-4">
          <h1 className="text-[#f5f5f5] text-lg font-semibold tracking-wide">
            Best Seller
          </h1>
          <a href="" className="text-[#025cca] text-sm font-semibold">
            Lihat semua
          </a>
        </div>

        <div className="px-4 pb-4 md:px-6">
          <div className="grid grid-cols-2 rounded-lg bg-[#1f1f1f] p-1">
            {bestSellerTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedBestSellerType(type)}
                className={`rounded-md px-4 py-2 text-sm font-bold transition ${
                  selectedBestSellerType === type
                    ? "bg-[#a79981] text-[#101010]"
                    : "text-[#ababab] hover:text-[#f5f5f5]"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[340px] overflow-y-auto scrollbar-hide px-4 pb-4 md:px-6 xl:h-[340px]">
          <div className="space-y-3">
            {filteredBestSellingMenus.map((dish, index) => {
              return (
                <div
                  key={dish.id}
                  className="flex items-center gap-4 bg-[#1f1f1f] rounded-[15px] px-4 py-3"
                >
                  <h1 className="text-[#f5f5f5] font-bold text-xl">
                    {index + 1}
                  </h1>
                  <img
                    src={resolveMenuImage(dish.image)}
                    alt={dish.name}
                    onError={(event) => {
                      event.currentTarget.src = noImage;
                    }}
                    className="w-[50px] h-[50px] rounded-full object-cover"
                  />
                  <div>
                    <h1 className="text-[#f5f5f5] font-semibold tracking-wide">{dish.name}</h1>
                    <p className="text-[#f5f5f5] text-sm font-semibold mt-1">
                      <span className="text-[#ababab]">Terjual: </span>
                      {dish.numberOfOrders}
                    </p>
                  </div>
                </div>
              );
            })}
            {filteredBestSellingMenus.length === 0 && (
              <p className="rounded-[15px] bg-[#1f1f1f] px-4 py-6 text-center text-sm font-semibold text-[#ababab]">
                Belum ada data penjualan.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-[#1a1a1a] w-full rounded-lg">
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-[#f5f5f5] text-lg font-semibold tracking-wide">
            Paket Catering
          </h2>
          <span className="rounded-md bg-[#a79981] px-2 py-1 text-xs font-bold text-[#101010]">
            Pre-order
          </span>
        </div>

        <div className="max-h-[310px] overflow-y-auto scrollbar-hide px-4 pb-4 md:px-6">
          <div className="space-y-3">
            {cateringPackages.slice(0, 3).map((item, index) => (
              <div
                key={item.id}
                className="flex items-center gap-4 rounded-[15px] bg-[#1f1f1f] px-4 py-3"
              >
                <h3 className="text-[#f5f5f5] font-bold text-xl">
                  {index + 1}
                </h3>
                <img
                  src={resolveMenuImage(item.image)}
                  alt={item.name}
                  onError={(event) => {
                    event.currentTarget.src = noImage;
                  }}
                  className="h-[50px] w-[50px] rounded-full object-cover"
                />
                <div className="min-w-0">
                  <h3 className="truncate font-semibold tracking-wide text-[#f5f5f5]">
                    {item.name}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-[#f5f5f5]">
                    <span className="text-[#ababab]">Mulai dari: </span>
                    {formatCurrency(item.price)}
                  </p>
                </div>
              </div>
            ))}
            </div>
        </div>
      </div>
    </div>
  );
};

export default PopularDishes;
