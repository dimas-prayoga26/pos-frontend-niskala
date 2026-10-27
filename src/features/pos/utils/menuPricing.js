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

// Cart line id: "<categoryId>-<menuItemId>".
export const getCartItemId = (item, category) => `${category.id}-${item.id}`;

export const buildCartItem = (item, { category, isOnlineOrder }) => {
  const cartItemId = getCartItemId(item, category);
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
  };
};
