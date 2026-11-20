// Loyalty rewards claimed in the cart. Each reward is a Kategori Promo menu
// marked for its stamp (loyaltyRewardStamps: 5 Minuman gratis, 10 Makanan
// gratis): a free promo (Harga 0, Diskon 100%) whose choice the cashier picks
// like any promo package. It never shows in the menu grid; Tukar puts it in
// the order and the reward is redeemed when the order is saved.
import { buildBundleSlots, pickedBundleChoices } from "./bundleChoices";
import { buildCartItem } from "./menuPricing";

export const LOYALTY_LINE_PREFIX = "loyalty-";

// The rewards a promo menu can be marked for (the loyalty app's rewards).
export const LOYALTY_REWARD_OPTIONS = [
  { stamps: 5, label: "Minuman gratis" },
  { stamps: 10, label: "Makanan gratis" },
];

export const loyaltyRewardOptionLabel = (stamps) => {
  const option = LOYALTY_REWARD_OPTIONS.find((candidate) => candidate.stamps === Number(stamps));
  return option ? `Stamp ke-${option.stamps} · ${option.label}` : `Stamp ke-${stamps}`;
};

// Order lines given as a reward: in the cart (loyaltyReward) or as saved
// (their line key starts with loyalty-).
export const isLoyaltyLine = (item) =>
  Boolean(item?.loyaltyReward) || String(item?.id ?? "").startsWith(LOYALTY_LINE_PREFIX);

// Lines in the cart for one reward (by its stamp).
export const loyaltyLinesOf = (cart, stamps) =>
  cart.filter((item) => Number(item.loyaltyReward?.stamps) === Number(stamps));

// The catalog the menu grid shows: without the reward promos.
export const hideLoyaltyRewardMenus = (catalog) =>
  catalog.map((category) => ({
    ...category,
    items: category.items.filter((menu) => !menu.loyaltyRewardStamps),
  }));

// The promo menu given for a reward, with its category, or null.
export const findLoyaltyRewardMenu = (catalog, stamps) => {
  for (const category of catalog) {
    const menu = category.items.find((item) => Number(item.loyaltyRewardStamps) === Number(stamps));
    if (menu) return { menu, category };
  }
  return null;
};

// The cart line of a reward: its promo package (choices to pick in the order
// details), 100% off, one portion, tied to the number it was claimed for.
export const buildLoyaltyRewardLine = ({ reward, menu, category, catalog, phone, cart = [] }) => {
  const bundleSlots = buildBundleSlots(menu, catalog);
  const taken = cart.filter((item) => String(item.id).startsWith(`${LOYALTY_LINE_PREFIX}${reward.stamps}-`)).length;

  return {
    ...buildCartItem(menu, { category, isOnlineOrder: false }),
    id: `${LOYALTY_LINE_PREFIX}${reward.stamps}-${menu.id}-${taken + 1}`,
    bundleSlots,
    // A choice of one menu starts picked.
    bundleChoices: pickedBundleChoices(bundleSlots),
    variant: reward.label,
    discountPercent: 100,
    quantity: 1,
    loyaltyReward: { stamps: reward.stamps, label: reward.label, phone },
  };
};

// The reward's name on a saved line (its variant: "Minuman gratis").
export const loyaltyRewardLabelOf = (item) =>
  item?.loyaltyReward?.label ||
  String(item?.variant || "")
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part && !/^(hot|cold|ice|iced)$/i.test(part))
    .join(" / ");
