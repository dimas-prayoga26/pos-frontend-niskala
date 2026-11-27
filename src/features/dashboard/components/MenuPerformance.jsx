import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import noImage from "../../../assets/no-image.svg";
import { formatCurrency } from "../../../shared/lib/format";
import { getJakartaDateKey } from "../../../shared/lib/dates";
import { isCrewOrder } from "../../orders";
import OrderDateRangeFilter from "../../orders/components/OrderDateRangeFilter";
import { rankBestSellers, resolveMenuImage, salesRevenue } from "../../home/utils/bestSeller";
import { DEFAULT_PERIOD, PERIOD_OPTIONS, periodRange, rangeLabel } from "../../inventory/utils/periods";
import { getMenuItems, getOrders } from "../api";
import { buildMenuRows, trendRanges, unsoldMenus } from "../utils/menuTable";
import CategoryRevenueDonut from "./CategoryRevenueDonut";
import MenuDetailTable from "./MenuDetailTable";
import TopMenusBarChart from "./TopMenusBarChart";
import { GROUP_STYLES, MENU_GROUPS, OTHER, menuGroupOf } from "./menuGroups";

// The Top 10 bar chart and the omzet donut: hidden 2026-11-17, shown again
// 2026-11-18 at the user's request; set to false to hide them.
const SHOW_CHARTS = true;

const isInRange = (dateKey, { from, to }) =>
  Boolean(dateKey) && (!from || dateKey >= from) && (!to || dateKey <= to);

// The whole tab follows this order: most sold first (Paling Laku), or Kurang Laku
// (least first, menus not sold at all included).
const ORDERS = [
  { key: "top", label: "Paling Laku" },
  { key: "least", label: "Kurang Laku" },
];

// Same look as the Metrik cards: one neutral surface, the brand accent on the
// icon; the kind reads from its icon and title.
const TopMenuCard = ({ group, dish, least, isLoading }) => {
  const { Icon } = GROUP_STYLES[group];
  const title = `${group} ${least ? "Kurang Laku" : "Paling Laku"}`;

  return (
    <section aria-label={title} className="min-h-[148px] rounded-lg border border-[#333] bg-[#262626] p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#a79981]/10 text-[#a79981]">
            <Icon className="text-lg" />
          </span>
          <p className="text-sm font-bold text-[#f5f5f5]">{title}</p>
        </div>
        <span className="rounded-md bg-[#1f1f1f] px-2 py-1 text-xs font-bold text-[#ababab]">#1</span>
      </div>

      {isLoading ? (
        <p className="mt-4 text-2xl font-bold text-[#f5f5f5]">...</p>
      ) : dish ? (
        <div className="mt-4 flex items-center gap-4">
          <img
            src={resolveMenuImage(dish.image)}
            alt={dish.name}
            onError={(event) => {
              event.currentTarget.src = noImage;
            }}
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
          />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-[#f5f5f5]" title={dish.name}>
              {dish.name}
            </p>
            <p className="mt-1 text-sm font-semibold text-[#d8d8d8]">
              {dish.numberOfOrders} terjual · {formatCurrency(dish.revenue)}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm font-semibold text-[#ababab]">
          {least ? "Belum ada menu." : "Belum ada penjualan di periode ini."}
        </p>
      )}
    </section>
  );
};

// Menu Paling Laku tab, for the chosen period: the most sold menu (Top 1) of
// Makanan, Minuman, Snack and Bundling, the Top 10 menus and each kind's share
// of the omzet (charts behind SHOW_CHARTS), and every menu sold in the Rincian
// Menu table, with its trend over the period before. Kurang Laku turns the
// cards, the Top 10 and the table round (least first, menus not sold at all
// included); the omzet share per kind stays as it is. A Konsumsi Crew is not a
// sale.
const MenuPerformance = ({ showCharts = SHOW_CHARTS }) => {
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [customRange, setCustomRange] = useState({});
  const [order, setOrder] = useState("top");
  const least = order === "least";

  const { data: ordersRes, isLoading: isOrdersLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
    placeholderData: keepPreviousData,
  });
  const { data: menuItemsRes, isLoading: isMenuItemsLoading } = useQuery({
    queryKey: ["menu-items"],
    queryFn: () => getMenuItems(),
    placeholderData: keepPreviousData,
  });

  const range = useMemo(() => periodRange(period, customRange), [period, customRange]);
  const trend = useMemo(() => trendRanges(period, range), [period, range]);
  // The sales (no Konsumsi Crew) of some days.
  const salesOrdersIn = useMemo(() => {
    const salesOrders = (ordersRes?.data?.data || []).filter((order) => !isCrewOrder(order));
    return (days) => salesOrders.filter((order) => isInRange(getJakartaDateKey(order.orderDate), days));
  }, [ordersRes]);
  // Menus sold in some days, most sold first, each with its kind and omzet.
  const rankMenusIn = useMemo(() => {
    const menuItems = menuItemsRes?.data?.data || [];
    return (days) => rankBestSellers(salesOrdersIn(days), menuItems, menuGroupOf);
  }, [menuItemsRes, salesOrdersIn]);
  const rankedMenus = useMemo(() => rankMenusIn(range), [rankMenusIn, range]);
  const periodRevenue = useMemo(() => salesRevenue(salesOrdersIn(range)), [salesOrdersIn, range]);
  const previousMenus = useMemo(() => trend && rankMenusIn(trend.previous), [trend, rankMenusIn]);
  // On sale but not sold once in the period: the bottom of Kurang Laku.
  const notSoldMenus = useMemo(
    () => unsoldMenus(menuItemsRes?.data?.data || [], rankedMenus, menuGroupOf),
    [menuItemsRes, rankedMenus]
  );
  // What the cards and the Top 10 show: most sold first, or least sold first
  // (qty, then omzet) with the menus not sold at all.
  const shownMenus = useMemo(
    () =>
      least
        ? buildMenuRows([...rankedMenus, ...notSoldMenus], null, { sortKey: "numberOfOrders", least: true })
        : rankedMenus,
    [least, notSoldMenus, rankedMenus]
  );
  const topByGroup = useMemo(
    () => new Map(MENU_GROUPS.map((group) => [group, shownMenus.find((dish) => dish.group === group)])),
    [shownMenus]
  );
  // Each kind's omzet, then Lainnya (Add Ons, menus since deleted) when sold,
  // so the donut's total is the whole omzet, the same as Rekap New's.
  const revenueSlices = useMemo(() => {
    const kinds = MENU_GROUPS.map((group) => ({
      group,
      revenue: rankedMenus.reduce((sum, dish) => (dish.group === group ? sum + dish.revenue : sum), 0),
    }));
    const other = periodRevenue - kinds.reduce((sum, slice) => sum + slice.revenue, 0);
    return other > 0 ? [...kinds, { group: OTHER, revenue: other }] : kinds;
  }, [periodRevenue, rankedMenus]);
  const isLoading = isOrdersLoading || isMenuItemsLoading;

  return (
    <div className="container mx-auto py-2 px-4 md:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#f5f5f5]">{least ? "Menu Kurang Laku" : "Menu Paling Laku"}</h2>
          <p className="text-sm text-[#ababab]">{least ? "Menu paling sepi per jenis." : "Menu paling ramai per jenis."}</p>
        </div>
        <div role="group" aria-label="Filter periode" className="flex flex-wrap items-center gap-2 text-sm">
          <div role="group" aria-label="Urutan" className="flex gap-1 rounded-lg bg-[#1f1f1f] p-1">
            {ORDERS.map((option) => (
              <button
                key={option.key}
                type="button"
                aria-pressed={order === option.key}
                onClick={() => setOrder(option.key)}
                className={`rounded-md px-3 py-1.5 text-sm font-bold transition ${
                  order === option.key ? "bg-[#a79981] text-[#101010]" : "text-[#ababab] hover:text-[#f5f5f5]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <select
            aria-label="Periode"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            className="rounded-lg border border-[#555] bg-[#262626] px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#d6c7ae]"
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          {period === "custom" && (
            <OrderDateRangeFilter
              label=""
              inputId="best-seller-date-range"
              dateRange={{ startDate: customRange.from, endDate: customRange.to }}
              onChange={({ startDate, endDate }) => setCustomRange({ from: startDate, to: endDate })}
            />
          )}
          <span className="text-xs text-[#ababab]">{rangeLabel(range)}</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {MENU_GROUPS.map((group) => (
          <TopMenuCard key={group} group={group} dish={topByGroup.get(group)} least={least} isLoading={isLoading} />
        ))}
      </div>

      {showCharts && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <TopMenusBarChart menus={shownMenus.slice(0, 10)} least={least} isLoading={isLoading} />
          </div>
          <div className="lg:col-span-2">
            <CategoryRevenueDonut slices={revenueSlices} isLoading={isLoading} />
          </div>
        </div>
      )}

      <MenuDetailTable
        menus={rankedMenus}
        unsoldMenus={notSoldMenus}
        least={least}
        previousMenus={previousMenus}
        trendLabel={trend && `${rangeLabel(trend.current)} dibanding ${rangeLabel(trend.previous)}`}
        isLoading={isLoading}
      />
    </div>
  );
};

export default MenuPerformance;
