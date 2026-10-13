// Price rules for adding menu items to the cart.
// Items with two or more sizes are priced per size (keys "Reguler"/"Large");
// online orders use the online price when the item is on online platforms.
export const DEFAULT_SIZE_NAME = "Reguler";

const hasOnlinePrice = (price) => price !== null && price !== undefined && price !== "";

export const getMenuPrice = (regularPrice, onlinePrice, includeOnlinePlatform, isOnlineOrder) => {
  if (isOnlineOrder && includeOnlinePlatform && hasOnlinePrice(onlinePrice)) {
    return Number(onlinePrice) || 0;
  }

  return Number(regularPrice) || 0;
};

export const getBaseItemPrice = (item) =>
  item.sizes?.[0]?.price ?? item.regularPrice ?? item.price;

export const getOriginalSizePrices = (item) => {
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

export const getSizePrices = (item) => {
  const originalSizePrices = getOriginalSizePrices(item);

  if (!originalSizePrices) return null;

  return {
    Reguler: Number(originalSizePrices.Reguler) || 0,
    Large: Number(originalSizePrices.Large) || 0,
  };
};

export const getSelectedSizeName = (item, selectedSizeByItem) =>
  selectedSizeByItem[item.id] || item.sizes?.[0]?.name || DEFAULT_SIZE_NAME;

// Cart line id: "<categoryId>-<menuItemId>[-<size>]".
export const getCartItemId = (item, category, selectedSize) => {
  const hasSizes = (item.sizes || []).length > 0;

  return `${category.id}-${item.id}${hasSizes ? `-${selectedSize}` : ""}`;
};

export const getItemUnitPrice = (item, selectedSize, isOnlineOrder) =>
  getSizePrices(item)?.[selectedSize] ??
  getMenuPrice(getBaseItemPrice(item), item.onlinePrice, item.includeOnlinePlatform, isOnlineOrder);

export const buildCartItem = (item, { category, selectedSize, isOnlineOrder }) => {
  const cartItemId = getCartItemId(item, category, selectedSize);
  const originalSizePrices = getOriginalSizePrices(item);
  const sizePrices = getSizePrices(item);
  const menuPrice = getItemUnitPrice(item, selectedSize, isOnlineOrder);

  return {
    id: cartItemId,
    menuItemId: cartItemId,
    sourceMenuItemId: item.id,
    name: item.name,
    categoryName: category.name,
    taxRate: item.taxRate ?? category.taxRate ?? null,
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
