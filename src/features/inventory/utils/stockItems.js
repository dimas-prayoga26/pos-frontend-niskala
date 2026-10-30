export const STOCK_PAGE_SIZE = 10;

// Badge colors per status computed by the backend.
export const STOCK_STATUS_CLASS_NAMES = {
  "BEBAS STOK": "bg-[#314259] text-blue-200",
  "HARUS ORDER": "bg-[#4a2e2e] text-red-400",
  "HARUS MASAK": "bg-[#4a2e2e] text-red-400",
  "HAMPIR HABIS": "bg-[#4a452e] text-yellow-400",
  AMAN: "bg-[#2e4a40] text-green-400",
};

// Bahan Resep: the bahan baku offered in the recipe editors (menu resep and
// bahan setengah jadi). Older payloads without the flag count as bahan resep.
export const isRecipeIngredient = (item) => item?.isRecipeIngredient !== false;

export const RECIPE_USE_FILTERS = [
  { key: "all", label: "Semua" },
  { key: "recipe", label: "Bahan Resep" },
  { key: "other", label: "Bukan Resep" },
];

export const filterByRecipeUse = (stockItems, filterKey) => {
  if (filterKey === "recipe") return stockItems.filter(isRecipeIngredient);
  if (filterKey === "other") return stockItems.filter((item) => !isRecipeIngredient(item));
  return stockItems;
};

const roundCurrency = (value) => Math.round((Number(value) || 0) * 100) / 100;
const roundCost = (value) => Math.round((Number(value) || 0) * 10000) / 10000;

// Matches the keyword against every visible column.
export const filterStockItems = (stockItems, searchQuery) => {
  const keyword = searchQuery.trim().toLowerCase();

  if (!keyword) return stockItems;

  return stockItems.filter((item) =>
    [
      item.name,
      item.category,
      item.unit,
      item.stock,
      item.minimumStock,
      item.averageCost,
      item.stockValue,
      item.status,
      item.supplier,
    ]
      .join(" ")
      .toLowerCase()
      .includes(keyword)
  );
};

// "1,5" and "1.5" are both accepted; empty input is NaN.
export const parseCostInput = (value) => {
  const normalized = String(value ?? "").trim().replace(",", ".");

  return normalized === "" ? NaN : Number(normalized);
};

export const getStockQuantity = (item) => Math.max(Number(item?.stock || 0), 0);

// COGS per stock unit = package price / package quantity (4 decimals).
export const getPackageCostValue = (form) => {
  const packageQuantity = parseCostInput(form.packageQuantity);
  const packagePrice = Number(form.packagePrice || 0);

  if (!Number.isFinite(packageQuantity) || packageQuantity <= 0) return 0;

  return roundCost(packagePrice / packageQuantity);
};

// Asset value after the change: current stock (never negative) x new COGS.
export const getAssetValueFromPackage = (item, form) =>
  roundCurrency(getStockQuantity(item) * getPackageCostValue(form));
