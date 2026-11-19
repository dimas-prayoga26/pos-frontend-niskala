import { useId, useMemo, useState } from "react";
import { MdArrowDownward } from "react-icons/md";
import { formatCurrency } from "../../../shared/lib/format";
import { buildMenuRows } from "../utils/menuTable";
import { MENU_GROUPS } from "./menuGroups";

const FILTERS = [{ key: "", label: "Semua" }, ...MENU_GROUPS.map((group) => ({ key: group, label: group }))];

const numberFormatter = new Intl.NumberFormat("id-ID");
// Kontribusi in full (0,044%): with one decimal, small sellers showed 0%.
const shareFormatter = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

// "+14%", "-3%", "0%"; "Baru" for a menu that sold nothing before, "—" when
// there is nothing to compare with. Up and down also show by their sign.
const TrendValue = ({ trend }) => {
  if (trend === null) return <span className="text-[#ababab]">—</span>;
  if (trend === "new") return <span className="font-semibold text-[#d6c7ae]">Baru</span>;

  const percent = Math.round(trend * 100);
  const tone = percent > 0 ? "text-emerald-300" : percent < 0 ? "text-red-300" : "text-[#ababab]";
  return (
    <span className={`font-semibold ${tone}`}>
      {percent > 0 ? "+" : ""}
      {numberFormatter.format(percent)}%
    </span>
  );
};

// A column the table can be ordered by (most first).
const SortHeader = ({ label, column, sortKey, onSort }) => {
  const isActive = sortKey === column;

  return (
    <th scope="col" aria-sort={isActive ? "descending" : "none"} className="p-3 text-right">
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 uppercase ${isActive ? "text-[#f5f5f5]" : "hover:text-[#f5f5f5]"}`}
      >
        {label}
        {isActive && <MdArrowDownward aria-hidden="true" />}
      </button>
    </th>
  );
};

// Rincian Menu: every menu sold in the period, filtered by kind and ordered by
// omzet or by qty.
const MenuDetailTable = ({ menus, previousMenus, trendLabel, isLoading }) => {
  const titleId = useId();
  const [group, setGroup] = useState("");
  const [sortKey, setSortKey] = useState("revenue");
  const rows = useMemo(
    () => buildMenuRows(menus, previousMenus, { group, sortKey }),
    [group, menus, previousMenus, sortKey]
  );

  let emptyText = "";
  if (isLoading) emptyText = "...";
  else if (rows.length === 0) emptyText = "Belum ada penjualan di periode ini.";

  return (
    <section aria-labelledby={titleId} className="mt-4 rounded-lg border border-[#333] bg-[#262626] p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 id={titleId} className="text-base font-bold text-[#f5f5f5]">
            Rincian Menu
          </h3>
          {trendLabel && <p className="text-xs text-[#ababab]">Tren omzet {trendLabel}</p>}
        </div>
        <div role="group" aria-label="Filter kategori" className="flex flex-wrap gap-1 rounded-lg bg-[#1f1f1f] p-1">
          {FILTERS.map((filter) => (
            <button
              key={filter.label}
              type="button"
              aria-pressed={group === filter.key}
              onClick={() => setGroup(filter.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-bold transition ${
                group === filter.key ? "bg-[#a79981] text-[#101010]" : "text-[#ababab] hover:text-[#f5f5f5]"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-md border border-[#333]">
        <table aria-labelledby={titleId} className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-[#1f1f1f] text-xs font-bold uppercase text-[#ababab]">
            <tr>
              <th scope="col" className="w-24 p-3 text-center">
                Peringkat
              </th>
              <th scope="col" className="p-3">
                Nama Menu
              </th>
              <th scope="col" className="p-3">
                Kategori
              </th>
              <SortHeader label="Terjual" column="numberOfOrders" sortKey={sortKey} onSort={setSortKey} />
              <SortHeader label="Total Omzet" column="revenue" sortKey={sortKey} onSort={setSortKey} />
              <th scope="col" className="p-3 text-right">
                Kontribusi
              </th>
              <th scope="col" className="p-3 text-right">
                Tren
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {emptyText ? (
              <tr>
                <td colSpan={7} className="p-4 text-center text-[#ababab]">
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-[#333] hover:bg-[#2c2c2c]">
                  <td className="p-3 text-center font-bold text-[#f5f5f5]">{row.rank}</td>
                  <td className="p-3">
                    <span className="block font-semibold text-[#f5f5f5]">{row.name}</span>
                    <span className="block text-xs text-[#8a8a8a]">{row.categories.join(", ")}</span>
                  </td>
                  <td className="p-3 text-[#d8d8d8]">{row.group}</td>
                  <td className="p-3 text-right text-[#f5f5f5]">{numberFormatter.format(row.numberOfOrders)}</td>
                  <td className="p-3 text-right font-semibold text-[#f5f5f5]">{formatCurrency(row.revenue)}</td>
                  <td className="p-3 text-right text-[#d8d8d8]">{shareFormatter.format(row.share * 100)}%</td>
                  <td className="p-3 text-right">
                    <TrendValue trend={row.trend} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default MenuDetailTable;
