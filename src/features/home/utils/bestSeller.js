// Best Seller on Home. Each category belongs to one tab (Makanan, Minuman,
// Snack) or none (category.bestSellerGroup), set in Pengaturan → Best Seller.
export const BEST_SELLER_GROUPS = ["Makanan", "Minuman", "Snack"];

const normalizeName = (value) => String(value || "").trim().toLowerCase();

// Menus sold across orders, most sold first, each with its tab (group). An
// order line counts for the menu it was sold as (menuItemId), so a renamed
// menu keeps its sales; lines without one are matched by name. Lines are
// summed per current menu name (the Ice and Hot copy of a menu together). A
// line without a menu, or whose category is in no tab, is left out.
export const rankBestSellers = (orders, menuItems) => {
  const menuById = new Map(menuItems.map((item) => [String(item.id), item]));
  const menuByName = new Map(menuItems.map((item) => [normalizeName(item.name), item]));
  const salesByName = new Map();

  orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const menuItem =
        (item.menuItemId != null && menuById.get(String(item.menuItemId))) || menuByName.get(normalizeName(item.name));
      const group = menuItem?.category?.bestSellerGroup;
      const name = normalizeName(menuItem?.name);
      if (!name || !group) return;

      const current = salesByName.get(name) || {
        id: menuItem.id || name,
        image: menuItem.imagePath,
        name: menuItem.name,
        numberOfOrders: 0,
        group,
      };
      current.numberOfOrders += Number(item.quantity) || 0;
      salesByName.set(name, current);
    });
  });

  return [...salesByName.values()].sort((first, second) => second.numberOfOrders - first.numberOfOrders);
};
