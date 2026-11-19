import { getJakartaDateKey } from "../../../shared/lib/dates";

// Calendar days (YYYY-MM-DD) as UTC dates, so the arithmetic ignores the
// browser time zone.
const toDate = (key) => new Date(`${key}T00:00:00Z`);
const toKey = (date) => date.toISOString().slice(0, 10);
const addDays = (key, days) => {
  const date = toDate(key);
  date.setUTCDate(date.getUTCDate() + days);
  return toKey(date);
};
// The same day some months away, kept inside that month (31 Mar → 28 Feb).
const addMonths = (key, months) => {
  const [year, month, day] = key.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  return toKey(new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDay))));
};
const daysBetween = (from, to) => Math.round((toDate(to) - toDate(from)) / 86_400_000);

// The days a period's Tren covers (current: the period up to today) and the
// days it compares with (previous: the same stretch one period back). Bulan
// Ini on the 18th → the 1st–18th against the 1st–18th of last month. Hari Ini
// → yesterday, Minggu Ini → last week, Tahun Ini → last year, a custom range →
// as many days right before it. None for Semua Waktu, an open or a future
// range.
export const trendRanges = (period, range = {}, today = new Date()) => {
  const todayKey = getJakartaDateKey(today);
  if (!range.from || !range.to || range.from > todayKey) return null;

  const current = { from: range.from, to: range.to < todayKey ? range.to : todayKey };
  const shifts = {
    today: (key) => addDays(key, -1),
    week: (key) => addDays(key, -7),
    month: (key) => addMonths(key, -1),
    year: (key) => addMonths(key, -12),
  };
  const shift = shifts[period] || ((key) => addDays(key, -(daysBetween(current.from, current.to) + 1)));
  return { current, previous: { from: shift(current.from), to: shift(current.to) } };
};

const menuKey = (menu) => menu.name.trim().toLowerCase();

// Menus on sale that sold nothing in the period, shaped like rankBestSellers'
// rows (0 sold, Rp 0): the least wanted of all, for Kurang Laku. The Ice
// and Hot copy of a menu are one row; a menu in no kind (groupOf) is left out.
export const unsoldMenus = (menuItems, soldMenus, groupOf) => {
  const sold = new Set(soldMenus.map(menuKey));
  const byName = new Map();

  menuItems.forEach((item) => {
    const group = groupOf(item);
    const key = menuKey(item);
    if (!group || sold.has(key)) return;

    const row = byName.get(key) || {
      id: item.id,
      image: item.imagePath,
      name: item.name,
      numberOfOrders: 0,
      revenue: 0,
      group,
      categories: [],
    };
    const categoryName = item.category?.name;
    if (categoryName && !row.categories.includes(categoryName)) row.categories.push(categoryName);
    byName.set(key, row);
  });

  return [...byName.values()];
};

// The Rincian Menu rows: the menus sold (rankBestSellers), of one kind or all
// (group ""), most first by sortKey ("revenue" or "numberOfOrders"), or least
// first with least (Kurang Laku); equal menus share a rank. share: of the
// whole period's omzet, whatever the filter. trend: the omzet change from
// previousMenus (0.14 = +14%), "new" when it sold nothing then, null without a
// previous period.
export const buildMenuRows = (menus, previousMenus, { group = "", sortKey = "revenue", least = false } = {}) => {
  const totalRevenue = menus.reduce((sum, menu) => sum + menu.revenue, 0);
  const previousRevenue = previousMenus && new Map(previousMenus.map((menu) => [menuKey(menu), menu.revenue]));
  const otherKey = sortKey === "revenue" ? "numberOfOrders" : "revenue";
  const direction = least ? -1 : 1;

  const trendOf = (menu) => {
    if (!previousRevenue) return null;
    const before = previousRevenue.get(menuKey(menu)) || 0;
    if (before) return (menu.revenue - before) / before;
    return menu.revenue > 0 ? "new" : null;
  };

  const rows = menus
    .filter((menu) => !group || menu.group === group)
    .map((menu) => ({ ...menu, share: totalRevenue ? menu.revenue / totalRevenue : 0, trend: trendOf(menu) }))
    .sort(
      (first, second) =>
        direction * (second[sortKey] - first[sortKey]) ||
        direction * (second[otherKey] - first[otherKey]) ||
        first.name.localeCompare(second.name, "id")
    );

  return rows.map((row) => ({
    ...row,
    rank: rows.findIndex((other) => other[sortKey] === row[sortKey]) + 1,
  }));
};
