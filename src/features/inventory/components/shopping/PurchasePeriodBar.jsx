import OrderDateRangeFilter from "../../../orders/components/OrderDateRangeFilter";
import { PERIOD_OPTIONS } from "../../utils/periods";

const fieldClass =
  "rounded-lg border border-[#555] bg-[#262626] px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#d6c7ae] disabled:opacity-50";
const exportClass =
  "rounded-lg border border-[#a79981]/50 px-3 py-2 text-sm font-semibold text-[#d6c7ae] hover:bg-[#a79981]/10 disabled:opacity-50";

// Area Filter Global of the Belanja page: the period (Hari Ini, Minggu Ini,
// Bulan Ini, Tahun Ini, Semua Waktu, Custom Date) of the history and its TOTAL
// PENGELUARAN, and the Excel / PDF export of what is shown. Custom Date uses
// the same calendar picker as the orders. Peralatan are assets, so their tab
// is lifetime: the period is off there.
const PurchasePeriodBar = ({ period, onPeriodChange, customRange, onCustomRangeChange, rangeText, isLifetime, onExport, isExporting }) => (
  <div
    role="group"
    aria-label="Filter periode"
    className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#181818] p-3"
  >
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label htmlFor="belanja-period" className="font-semibold text-[#ababab]">
        Periode
      </label>
      <select
        id="belanja-period"
        value={period}
        disabled={isLifetime}
        onChange={(event) => onPeriodChange(event.target.value)}
        className={fieldClass}
      >
        {PERIOD_OPTIONS.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
      {period === "custom" && !isLifetime && (
        <OrderDateRangeFilter
          label=""
          inputId="belanja-date-range"
          dateRange={{ startDate: customRange.from, endDate: customRange.to }}
          onChange={({ startDate, endDate }) => onCustomRangeChange({ from: startDate, to: endDate })}
        />
      )}
      <span className="text-xs text-[#ababab]">
        {isLifetime ? "Peralatan adalah aset: ditampilkan seumur hidup, tanpa filter periode." : rangeText}
      </span>
    </div>
    <div className="flex gap-2">
      <button type="button" onClick={() => onExport("excel")} disabled={isExporting} className={exportClass}>
        Export Excel
      </button>
      <button type="button" onClick={() => onExport("pdf")} disabled={isExporting} className={exportClass}>
        Export PDF
      </button>
    </div>
  </div>
);

export default PurchasePeriodBar;
