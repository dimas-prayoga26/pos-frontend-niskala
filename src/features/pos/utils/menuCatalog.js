// Fallback icons for categories saved without one.
const CATEGORY_ICONS = {
  Coffee: "☕",
  "Non-Coffee": "🥤",
  "Main Course": "🍚",
  Snack: "🍟",
  Catering: "🍱",
};

// Joins categories and menu items into the POS catalog. Online orders only
// list items marked for online platforms. Item tax falls back to the category.
export const buildMenuCatalog = (categories, menuItems, isOnlineOrder) =>
  categories.map((category) => ({
    id: category.id || category._id,
    name: category.name,
    icon: category.icon || CATEGORY_ICONS[category.name] || "",
    taxRate: category.taxRate ?? category.tax ?? null,
    items: menuItems
      .filter(
        (item) =>
          Number(item.categoryId) === Number(category.id || category._id) &&
          (!isOnlineOrder || Boolean(item.includeOnlinePlatform))
      )
      .map((item) => ({
        id: item.id || item._id,
        name: item.name,
        price: item.price,
        regularPrice: item.regularPrice ?? item.price,
        includeOnlinePlatform: Boolean(item.includeOnlinePlatform),
        onlinePrice: item.onlinePrice ?? null,
        imagePath: item.imagePath || null,
        taxRate:
          item.category?.taxRate ??
          item.category?.tax ??
          category.taxRate ??
          category.tax ??
          null,
      })),
  }));
