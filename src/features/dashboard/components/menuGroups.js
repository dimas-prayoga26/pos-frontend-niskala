import { MdBakeryDining, MdLocalCafe, MdMoreHoriz, MdRedeem, MdRestaurant } from "react-icons/md";
import { BEST_SELLER_GROUPS } from "../../home/utils/bestSeller";

// The kinds of menu on the Menu Paling Laku tab: the Best Seller tabs plus Bundling.
export const BUNDLING = "Bundling";
export const MENU_GROUPS = [...BEST_SELLER_GROUPS, BUNDLING];
// Only in the omzet donut: sales outside those kinds (Add Ons, menus since
// deleted), so its total is the period's whole omzet.
export const OTHER = "Lainnya";

// Per kind: its Top 1 card icon and its chart color. The cards themselves are
// all neutral; only the (hidden) charts color the kinds. The chart colors are
// checked (dataviz validate_palette, dark mode, surface #262626) for every
// neighbour in the donut ring, Makanan → Minuman → Snack → Bundling →
// Makanan; Minuman and Bundling never touch there. They are close in hue, so
// wherever any two kinds can meet (the Top 10 bars) the kind is also written.
export const GROUP_STYLES = {
  Makanan: { Icon: MdRestaurant, chart: "#199e70" },
  Minuman: { Icon: MdLocalCafe, chart: "#3987e5" },
  Snack: { Icon: MdBakeryDining, chart: "#c98500" },
  [BUNDLING]: { Icon: MdRedeem, chart: "#9085e9" },
  // A neutral gray, last in the ring between Bundling and Makanan (checked
  // against both).
  [OTHER]: { Icon: MdMoreHoriz, chart: "#b5b5b5" },
};

// Kategori Promo menus (packages) are Bundling; every other menu keeps its
// Best Seller tab from Pengaturan → Best Seller (none = left out).
export const menuGroupOf = (menuItem) =>
  menuItem.isBundle || menuItem.category?.isBundle ? BUNDLING : menuItem.category?.bestSellerGroup;
