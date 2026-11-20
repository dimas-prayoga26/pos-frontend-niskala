// Loyalty rewards claimed in the cart. A reward is given as a Kategori Promo
// menu set as Promo loyalty (isLoyaltyPromo): a free promo (Harga 0, Diskon
// 100%) whose choice the cashier picks like any promo package. Which reward
// gives which menu is set in Program Promo (the reward's
// promo_menu_item_id). It never shows in the menu grid; Tukar puts it in the
// order and the reward is redeemed when the order is saved.
import { buildBundleSlots, pickedBundleChoices } from "./bundleChoices";
import { buildCartItem } from "./menuPricing";

export const LOYALTY_LINE_PREFIX = "loyalty-";

// "Stamp ke-5 · Minuman gratis": a reward of the stamp card, as set in
// Program Promo (rewards: the program's, { stamps, label, active }).
export const loyaltyRewardOptionLabel = (stamps, rewards = []) => {
  const reward = rewards.find((candidate) => Number(candidate.stamps) === Number(stamps));
  if (!reward) return `Stamp ke-${stamps}`;
  return `Stamp ke-${reward.stamps} · ${reward.label}${reward.active === false ? " (nonaktif)" : ""}`;
};

// Order lines given as a reward: in the cart (loyaltyReward) or as saved
// (their line key starts with loyalty-).
export const isLoyaltyLine = (item) =>
  Boolean(item?.loyaltyReward) || String(item?.id ?? "").startsWith(LOYALTY_LINE_PREFIX);

// Lines in the cart for one reward (by its stamp).
export const loyaltyLinesOf = (cart, stamps) =>
  cart.filter((item) => Number(item.loyaltyReward?.stamps) === Number(stamps));

// The catalog the menu grid shows: without the Promo loyalty menus.
export const hideLoyaltyRewardMenus = (catalog) =>
  catalog.map((category) => ({
    ...category,
    items: category.items.filter((menu) => !menu.isLoyaltyPromo),
  }));

// The Promo loyalty menu a reward gives (its promo_menu_item_id, set in
// Program Promo), with its category, or null (none linked, or not on sale).
export const findLoyaltyRewardMenu = (catalog, menuItemId) => {
  if (!menuItemId) return null;
  for (const category of catalog) {
    const menu = category.items.find((item) => item.isLoyaltyPromo && Number(item.id) === Number(menuItemId));
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
