import { MdBakeryDining, MdLocalCafe, MdRedeem, MdRestaurant } from "react-icons/md";
import { BEST_SELLER_GROUPS } from "../../home/utils/bestSeller";

// The kinds of menu on the Menu Terlaris tab: the Best Seller tabs plus Bundling.
export const BUNDLING = "Bundling";
export const MENU_GROUPS = [...BEST_SELLER_GROUPS, BUNDLING];

// Per kind: its Top 1 card tone and its chart color. The chart colors are
// checked (dataviz validate_palette, dark mode, surface #262626) for every
// neighbour in the donut ring, Makanan → Minuman → Snack → Bundling →
// Makanan; Minuman and Bundling never touch there. They are close in hue, so
// wherever any two kinds can meet (the Top 10 bars) the kind is also written.
export const GROUP_STYLES = {
  Makanan: {
    Icon: MdRestaurant,
    card: "border-emerald-500/30 bg-emerald-500/10",
    icon: "bg-emerald-500/15 text-emerald-200",
    chart: "#199e70",
  },
  Minuman: {
    Icon: MdLocalCafe,
    card: "border-sky-500/30 bg-sky-500/10",
    icon: "bg-sky-500/15 text-sky-200",
    chart: "#3987e5",
  },
  Snack: {
    Icon: MdBakeryDining,
    card: "border-amber-500/30 bg-amber-500/10",
    icon: "bg-amber-500/15 text-amber-200",
    chart: "#c98500",
  },
  [BUNDLING]: {
    Icon: MdRedeem,
    card: "border-violet-500/30 bg-violet-500/10",
    icon: "bg-violet-500/15 text-violet-200",
    chart: "#9085e9",
  },
};

// Kategori Promo menus (packages) are Bundling; every other menu keeps its
// Best Seller tab from Pengaturan → Best Seller (none = left out).
export const menuGroupOf = (menuItem) =>
  menuItem.isBundle || menuItem.category?.isBundle ? BUNDLING : menuItem.category?.bestSellerGroup;
