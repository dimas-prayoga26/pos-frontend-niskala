import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import noImage from "../../../assets/no-image.svg";
import { formatCurrency } from "../../../shared/lib/format";
import { getJakartaDateKey } from "../../../shared/lib/dates";
import { isCrewOrder } from "../../orders";
import OrderDateRangeFilter from "../../orders/components/OrderDateRangeFilter";
import { rankBestSellers, resolveMenuImage } from "../../home/utils/bestSeller";
import { DEFAULT_PERIOD, PERIOD_OPTIONS, periodRange, rangeLabel } from "../../inventory/utils/periods";
import { getMenuItems, getOrders } from "../api";
import CategoryRevenueDonut from "./CategoryRevenueDonut";
import TopMenusBarChart from "./TopMenusBarChart";
import { GROUP_STYLES, MENU_GROUPS, menuGroupOf } from "./menuGroups";

// The Top 10 bar chart and the omzet donut are built but hidden for now, at the
// user's request (2026-11-17); set to true to show them again.
const SHOW_CHARTS = false;

const isInRange = (dateKey, { from, to }) =>
  Boolean(dateKey) && (!from || dateKey >= from) && (!to || dateKey <= to);

// Same look as the Metrik cards: one neutral surface, the brand accent on the
// icon; the kind reads from its icon and title.
const TopMenuCard = ({ group, dish, isLoading }) => {
  const { Icon } = GROUP_STYLES[group];
  const title = `${group} Terlaris`;

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
        <p className="mt-4 text-sm font-semibold text-[#ababab]">Belum ada penjualan di periode ini.</p>
      )}
    </section>
  );
};

// Menu Terlaris tab, for the chosen period: the most sold menu (Top 1) of
// Makanan, Minuman, Snack and Bundling, the Top 10 menus, and each kind's
// share of the omzet (charts behind SHOW_CHARTS). A Konsumsi Crew is not a sale.
const MenuPerformance = ({ showCharts = SHOW_CHARTS }) => {
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [customRange, setCustomRange] = useState({});

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
  // Menus sold in the period, most sold first, each with its kind and omzet.
  const rankedMenus = useMemo(() => {
    const salesOrders = (ordersRes?.data?.data || []).filter(
      (order) => !isCrewOrder(order) && isInRange(getJakartaDateKey(order.orderDate), range)
    );
    return rankBestSellers(salesOrders, menuItemsRes?.data?.data || [], menuGroupOf);
  }, [menuItemsRes, ordersRes, range]);
  const topByGroup = useMemo(
    () => new Map(MENU_GROUPS.map((group) => [group, rankedMenus.find((dish) => dish.group === group)])),
    [rankedMenus]
  );
  const revenueSlices = useMemo(
    () =>
      MENU_GROUPS.map((group) => ({
        group,
        revenue: rankedMenus.reduce((sum, dish) => (dish.group === group ? sum + dish.revenue : sum), 0),
      })),
    [rankedMenus]
  );
  const isLoading = isOrdersLoading || isMenuItemsLoading;

  return (
    <div className="container mx-auto py-2 px-4 md:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#f5f5f5]">Menu Terlaris</h2>
          <p className="text-sm text-[#ababab]">Menu paling laku per jenis.</p>
        </div>
        <div role="group" aria-label="Filter periode" className="flex flex-wrap items-center gap-2 text-sm">
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
          <TopMenuCard key={group} group={group} dish={topByGroup.get(group)} isLoading={isLoading} />
        ))}
      </div>

      {showCharts && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <TopMenusBarChart menus={rankedMenus.slice(0, 10)} isLoading={isLoading} />
          </div>
          <div className="lg:col-span-2">
            <CategoryRevenueDonut slices={revenueSlices} isLoading={isLoading} />
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuPerformance;
