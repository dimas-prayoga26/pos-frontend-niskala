// Price rules for adding menu items to the cart. Online orders use the online
// price when the item is on online platforms.
const hasOnlinePrice = (price) => price !== null && price !== undefined && price !== "";

const getBaseItemPrice = (item) => item.regularPrice ?? item.price;

export const getItemUnitPrice = (item, isOnlineOrder) => {
  if (isOnlineOrder && item.includeOnlinePlatform && hasOnlinePrice(item.onlinePrice)) {
    return Number(item.onlinePrice) || 0;
  }

  return Number(getBaseItemPrice(item)) || 0;
};

// The price on a menu card: a promo's price less its discount percent.
export const getMenuCardPrice = (item, isOnlineOrder) => {
  const price = getItemUnitPrice(item, isOnlineOrder);
  const discountPercent = Number(item.discountPercent) || 0;

  return discountPercent ? Math.round((price * (100 - discountPercent)) / 100) : price;
};

// Cart line id: "<categoryId>-<menuItemId>".
export const getCartItemId = (item, category) => `${category.id}-${item.id}`;

export const buildCartItem = (item, { category, isOnlineOrder }) => {
  const cartItemId = getCartItemId(item, category);
  const discountPercent = Number(item.discountPercent) || 0;
  const menuPrice = getItemUnitPrice(item, isOnlineOrder);

  return {
    id: cartItemId,
    menuItemId: cartItemId,
    sourceMenuItemId: item.id,
    name: item.name,
    categoryName: category.name,
    taxRate: item.taxRate ?? category.taxRate ?? null,
    basePrice: menuPrice,
    originalPrice: getBaseItemPrice(item),
    addOns: [],
    pricePerQuantity: menuPrice,
    // A promo package shows its fixed menus in the order details.
    ...(item.bundleItems?.length ? { bundleItems: item.bundleItems } : {}),
    // Bahan olahan the cashier may swap on the line (Nasi Daun Jeruk for Nasi Putih).
    ...(item.ingredientChoices?.length ? { ingredientChoices: item.ingredientChoices } : {}),
    // A promo with a discount: the cart takes the percent off its price.
    ...(discountPercent ? { discountPercent } : {}),
  };
};
