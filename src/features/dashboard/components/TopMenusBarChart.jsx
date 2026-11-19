import { formatCurrency } from "../../../shared/lib/format";
import useDrawIn from "../hooks/useDrawIn";
import { GROUP_STYLES, MENU_GROUPS } from "./menuGroups";

// Competition ranking: menus sold equally share a rank (1, 1, 1, 4, ...).
const rankOf = (menus, index) =>
  menus.findIndex((menu) => menu.numberOfOrders === menus[index].numberOfOrders) + 1;

// 10 Menu Paling Laku: one row per menu, most sold first, its bar as long as
// its qty against the best seller's and colored by its kind (legend above).
// The qty sits at the bar tip; hovering or focusing a row adds its omzet.
// least: the 10 least wanted instead (menus given least sold first).
const TopMenusBarChart = ({ menus, least = false, isLoading }) => {
  const isDrawn = useDrawIn();
  const title = least ? "10 Menu Kurang Laku" : "10 Menu Paling Laku";
  const maxQuantity = Math.max(0, ...menus.map((menu) => menu.numberOfOrders));
  const shownGroups = MENU_GROUPS.filter((group) => menus.some((menu) => menu.group === group));

  return (
    <section aria-labelledby="top-menus-title" className="h-full rounded-lg border border-[#333] bg-[#262626] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="top-menus-title" className="text-base font-bold text-[#f5f5f5]">
            {title}
          </h3>
          <p className="text-xs text-[#ababab]">Jumlah terjual</p>
        </div>
        {shownGroups.length > 1 && (
          <ul aria-label="Jenis menu" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#ababab]">
            {shownGroups.map((group) => (
              <li key={group} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: GROUP_STYLES[group].chart }} />
                {group}
              </li>
            ))}
          </ul>
        )}
      </div>

      {isLoading ? (
        <p className="mt-4 text-2xl font-bold text-[#f5f5f5]">...</p>
      ) : menus.length === 0 ? (
        <p className="mt-4 text-sm font-semibold text-[#ababab]">
          {least ? "Belum ada menu." : "Belum ada penjualan di periode ini."}
        </p>
      ) : (
        <ol aria-labelledby="top-menus-title" className="mt-4 space-y-0.5">
          {menus.map((menu, index) => {
            const rank = rankOf(menus, index);
            const share = maxQuantity ? (menu.numberOfOrders / maxQuantity) * 100 : 0;

            return (
              <li
                key={menu.id}
                tabIndex={0}
                aria-label={`${rank}. ${menu.name} (${menu.categories.join(", ")}), ${menu.group}: ${menu.numberOfOrders} terjual, ${formatCurrency(menu.revenue)}`}
                className="group relative grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-3 rounded-md px-2 py-1.5 outline-none transition-colors hover:bg-white/5 focus-visible:bg-white/5"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                      rank <= 3 ? "bg-[#a79981] text-[#101010]" : "bg-[#333] text-[#ababab]"
                    }`}
                  >
                    {rank}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm leading-tight text-[#e5e5e5] break-words">{menu.name}</span>
                    {/* Any two kinds can sit next to each other here, and Minuman and
                        Bundling are close in hue, so each row names its kind (and its
                        menu categories, as two menus can share a name). */}
                    <span className="block text-[11px] leading-tight text-[#8a8a8a]">
                      {[menu.group, ...menu.categories].join(" · ")}
                    </span>
                  </span>
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-[18px] shrink-0 rounded-r transition-[width,filter] duration-700 ease-out group-hover:brightness-110 motion-reduce:transition-none"
                    style={{
                      width: isDrawn ? `max(2px, calc(${share}% - 3rem))` : "0px",
                      backgroundColor: GROUP_STYLES[menu.group].chart,
                    }}
                  />
                  <span className="text-sm font-bold tabular-nums text-[#f5f5f5]">{menu.numberOfOrders}</span>
                </span>
                <span
                  role="tooltip"
                  className="pointer-events-none absolute right-2 top-[calc(100%+4px)] z-10 hidden rounded-lg border border-[#444] bg-[#151515] px-3 py-2 text-xs shadow-xl group-hover:block group-focus:block"
                >
                  <span className="block font-bold text-[#f5f5f5]">
                    {menu.numberOfOrders} terjual · {formatCurrency(menu.revenue)}
                  </span>
                  <span className="flex items-center gap-1.5 text-[#ababab]">
                    <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ backgroundColor: GROUP_STYLES[menu.group].chart }} />
                    {[menu.name, menu.group, ...menu.categories].join(" · ")}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};

export default TopMenusBarChart;
