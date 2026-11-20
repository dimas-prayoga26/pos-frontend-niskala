import noImage from "../../../assets/no-image.svg";
import { backendBaseUrl } from "../../../shared/api/backendUrl";
import { isLoyaltyLine } from "../../pos/utils/loyaltyReward";

// Best Seller on Home. Each category belongs to one tab (Makanan, Minuman,
// Snack) or none (category.bestSellerGroup), set in Pengaturan → Best Seller.
export const BEST_SELLER_GROUPS = ["Makanan", "Minuman", "Snack"];

const normalizeName = (value) => String(value || "").trim().toLowerCase();

// A menu's tab on Home: its category's.
const categoryGroup = (menuItem) => menuItem.category?.bestSellerGroup;

export const resolveMenuImage = (imagePath) => {
  if (!imagePath) return noImage;
  if (imagePath.startsWith("/uploads/")) return `${backendBaseUrl}${imagePath}`;

  return imagePath;
};

// Menus sold across orders, most sold first, each with its tab (group), its
// menu categories (categories: the Ice and Hot copy can sit in two) and what
// it brought in (revenue: the unit price charged × qty). An order line
// counts for the menu it was sold as (menuItemId), so a renamed menu keeps its
// sales; lines without one are matched by name. Lines are summed per current
// menu name (the Ice and Hot copy of a menu together). A line without a menu,
// or whose menu is in no tab (groupOf), is left out, and so is a loyalty
// reward given free (not a sale).
export const rankBestSellers = (orders, menuItems, groupOf = categoryGroup) => {
  const menuById = new Map(menuItems.map((item) => [String(item.id), item]));
  const menuByName = new Map(menuItems.map((item) => [normalizeName(item.name), item]));
  const salesByName = new Map();

  orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      if (isLoyaltyLine(item)) return;
      const menuItem =
        (item.menuItemId != null && menuById.get(String(item.menuItemId))) || menuByName.get(normalizeName(item.name));
      const group = menuItem && groupOf(menuItem);
      const name = normalizeName(menuItem?.name);
      if (!name || !group) return;

      const current = salesByName.get(name) || {
        id: menuItem.id || name,
        image: menuItem.imagePath,
        name: menuItem.name,
        numberOfOrders: 0,
        revenue: 0,
        group,
        categories: [],
      };
      const categoryName = menuItem.category?.name;
      if (categoryName && !current.categories.includes(categoryName)) current.categories.push(categoryName);
      const quantity = Number(item.quantity) || 0;
      current.numberOfOrders += quantity;
      current.revenue += (Number(item.pricePerQuantity ?? item.price) || 0) * quantity;
      salesByName.set(name, current);
    });
  });

  return [...salesByName.values()].sort((first, second) => second.numberOfOrders - first.numberOfOrders);
};
