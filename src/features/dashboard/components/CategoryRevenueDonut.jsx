import { useState } from "react";
import { formatCurrency } from "../../../shared/lib/format";
import useDrawIn from "../hooks/useDrawIn";
import { GROUP_STYLES } from "./menuGroups";

const SIZE = 200;
const STROKE = 24;
// Room around the ring for the hovered slice to thicken.
const RADIUS = (SIZE - STROKE) / 2 - 4;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// Surface gap between two slices, along the ring.
const SLICE_GAP = 2;

const percentFormatter = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
const formatShare = (share) => `${percentFormatter.format(share * 100)}%`;

// Komposisi Omzet per Kategori: each kind's share of the period's omzet as a
// slice of the ring, clockwise from the top in the kinds' fixed order. The
// centre shows the total, or the slice hovered or focused (on the ring or in
// the legend), which thickens while the others fade. The legend lists every
// kind with its amount, share and a bar of that share.
const CategoryRevenueDonut = ({ slices, isLoading }) => {
  const isDrawn = useDrawIn();
  const [activeGroup, setActiveGroup] = useState(null);
  const total = slices.reduce((sum, slice) => sum + slice.revenue, 0);
  const shareOf = (slice) => (total ? slice.revenue / total : 0);
  const soldSlices = slices.filter((slice) => slice.revenue > 0);
  const gap = soldSlices.length > 1 ? SLICE_GAP : 0;
  const arcs = soldSlices.reduce(
    (list, slice) => {
      const length = shareOf(slice) * CIRCUMFERENCE;
      return { start: list.start + length, items: [...list.items, { ...slice, start: list.start, length }] };
    },
    { start: 0, items: [] }
  ).items;
  const active = slices.find((slice) => slice.group === activeGroup);
  const summary = `Komposisi omzet: ${slices.map((slice) => `${slice.group} ${formatShare(shareOf(slice))}`).join(", ")}`;
  const highlight = (group) => ({
    onMouseEnter: () => setActiveGroup(group),
    onMouseLeave: () => setActiveGroup(null),
  });

  return (
    <section aria-labelledby="category-revenue-title" className="h-full rounded-lg border border-[#333] bg-[#262626] p-5">
      <h3 id="category-revenue-title" className="text-base font-bold text-[#f5f5f5]">
        Komposisi Omzet per Kategori
      </h3>
      <p className="text-xs text-[#ababab]">Bagian tiap jenis menu dari omzet</p>

      {isLoading ? (
        <p className="mt-4 text-2xl font-bold text-[#f5f5f5]">...</p>
      ) : total === 0 ? (
        <p className="mt-4 text-sm font-semibold text-[#ababab]">Belum ada penjualan di periode ini.</p>
      ) : (
        <>
          <div className="relative mx-auto mt-5 h-[200px] w-[200px]">
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={summary} className="h-full w-full -rotate-90">
              {arcs.map((arc) => {
                const isActive = activeGroup === arc.group;
                const length = Math.max(arc.length - gap, 1);

                return (
                  <circle
                    key={arc.group}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    stroke={GROUP_STYLES[arc.group].chart}
                    style={{
                      strokeWidth: isActive ? STROKE + 6 : STROKE,
                      strokeDasharray: isDrawn ? `${length} ${CIRCUMFERENCE}` : `0 ${CIRCUMFERENCE}`,
                      strokeDashoffset: isDrawn ? -arc.start : 0,
                      opacity: activeGroup && !isActive ? 0.35 : 1,
                    }}
                    {...highlight(arc.group)}
                    className="cursor-pointer transition-all duration-700 ease-out motion-reduce:transition-none"
                  />
                );
              })}
            </svg>
            <div aria-live="polite" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
              <span className="text-xs text-[#ababab]">{active ? active.group : "Total omzet"}</span>
              <span className="text-lg font-bold leading-tight text-[#f5f5f5]">
                {formatCurrency(active ? active.revenue : total)}
              </span>
              {active && <span className="text-xs font-semibold text-[#d8d8d8]">{formatShare(shareOf(active))}</span>}
            </div>
          </div>

          <ul className="mt-5 space-y-1">
            {slices.map((slice) => {
              const share = shareOf(slice);

              return (
                <li
                  key={slice.group}
                  tabIndex={0}
                  {...highlight(slice.group)}
                  onFocus={() => setActiveGroup(slice.group)}
                  onBlur={() => setActiveGroup(null)}
                  className={`rounded-md px-2 py-2 outline-none transition-colors hover:bg-white/5 focus-visible:bg-white/5 ${
                    activeGroup === slice.group ? "bg-white/5" : ""
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: GROUP_STYLES[slice.group].chart }} />
                    <span className="flex-1 text-sm text-[#e5e5e5]">{slice.group}</span>
                    <span className="text-xs tabular-nums text-[#ababab]">{formatCurrency(slice.revenue)}</span>
                    <span className="w-12 text-right text-sm font-bold tabular-nums text-[#f5f5f5]">{formatShare(share)}</span>
                  </div>
                  <div aria-hidden="true" className="ml-5 mt-1.5 h-1.5 rounded-full bg-[#333]">
                    <div
                      className="h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
                      style={{ width: isDrawn ? `${share * 100}%` : "0%", backgroundColor: GROUP_STYLES[slice.group].chart }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
};

export default CategoryRevenueDonut;
