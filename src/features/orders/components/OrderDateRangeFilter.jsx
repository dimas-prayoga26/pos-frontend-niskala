import { useEffect, useRef, useState } from "react";
import { DateRange } from "react-date-range";
import { MdClose, MdDateRange } from "react-icons/md";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import "./ordersDateRange.css";
import { formatJakartaReceiptDate, getJakartaDateKey } from "../../../shared/lib/dates";
import { getDateRangeLabel } from "../utils/orderFilters";

// The picker works with Date objects at Jakarta midnight; the applied range is
// stored as Jakarta date keys.
const dateKeyToPickerDate = (dateKey, todayKey) =>
  new Date(`${dateKey || todayKey}T00:00:00+07:00`);

// Also the Custom Date of the Belanja period filter, which passes its own
// label ("" for none) and input id.
const OrderDateRangeFilter = ({ dateRange, onChange, label = "Filter by date", inputId = "order-date-range-filter" }) => {
  const todayKey = getJakartaDateKey();
  const [draftDateRange, setDraftDateRange] = useState({
    startDate: dateKeyToPickerDate(todayKey, todayKey),
    endDate: dateKeyToPickerDate(todayKey, todayKey),
    key: "selection",
  });
  const [isDateRangePickerOpen, setIsDateRangePickerOpen] = useState(false);
  const dateRangePickerRef = useRef(null);
  const hasActiveDateRange = dateRange.startDate || dateRange.endDate;
  const draftDateRangeLabel = `${formatJakartaReceiptDate(
    draftDateRange.startDate
  )} - ${formatJakartaReceiptDate(draftDateRange.endDate)}`;

  // Close the popup on any pointer down outside it.
  useEffect(() => {
    if (!isDateRangePickerOpen) return;

    const handlePointerDown = (event) => {
      if (dateRangePickerRef.current?.contains(event.target)) return;

      setIsDateRangePickerOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isDateRangePickerOpen]);

  const handleOpenDateRangePicker = () => {
    const startDate = dateKeyToPickerDate(dateRange.startDate || todayKey, todayKey);
    const endDate = dateKeyToPickerDate(
      dateRange.endDate || dateRange.startDate || todayKey,
      todayKey
    );

    setDraftDateRange({
      startDate,
      endDate,
      key: "selection",
    });
    setIsDateRangePickerOpen(true);
  };
  const handleDraftDateRangeChange = (ranges) => {
    setDraftDateRange(ranges.selection);
  };
  const handleApplyDateRange = () => {
    const startDate = draftDateRange.startDate || draftDateRange.endDate;
    const endDate = draftDateRange.endDate || draftDateRange.startDate;

    onChange({
      startDate: getJakartaDateKey(startDate),
      endDate: getJakartaDateKey(endDate),
    });
    setIsDateRangePickerOpen(false);
  };
  const handleClearDateRange = () => {
    onChange({
      startDate: "",
      endDate: "",
    });
    setIsDateRangePickerOpen(false);
  };
  const handleSelectToday = () => {
    onChange({
      startDate: todayKey,
      endDate: todayKey,
    });
    setDraftDateRange({
      startDate: dateKeyToPickerDate(todayKey, todayKey),
      endDate: dateKeyToPickerDate(todayKey, todayKey),
      key: "selection",
    });
    setIsDateRangePickerOpen(false);
  };

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto lg:flex-row lg:items-center">
      {label && (
        <label className="text-sm font-semibold text-[#ababab]" htmlFor={inputId}>
          {label}
        </label>
      )}
      <div ref={dateRangePickerRef} className="relative w-full sm:w-72">
        <div className="flex items-center gap-2 rounded-lg bg-[#262626] px-3 py-2 text-sm font-semibold text-[#f5f5f5]">
          <MdDateRange className="shrink-0 text-[#a79981]" size={18} />
          <input
            id={inputId}
            type="text"
            readOnly
            value={getDateRangeLabel(dateRange)}
            onClick={handleOpenDateRangePicker}
            onFocus={handleOpenDateRangePicker}
            className="w-full cursor-pointer bg-transparent text-sm font-semibold text-[#f5f5f5] outline-none"
            aria-label="Pilih rentang tanggal"
            aria-expanded={isDateRangePickerOpen}
          />
        </div>

        {isDateRangePickerOpen && (
          <div className="orders-date-range-picker absolute right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-lg border border-[#333] bg-white shadow-2xl shadow-black/50">
            <DateRange
              ranges={[draftDateRange]}
              onChange={handleDraftDateRangeChange}
              months={1}
              direction="horizontal"
              moveRangeOnFirstSelection={false}
              showDateDisplay={false}
              rangeColors={["#a79981"]}
            />
            <div className="orders-date-range-footer border-t border-gray-200 bg-white">
              <p className="orders-date-range-summary font-semibold text-gray-600">
                {draftDateRangeLabel}
              </p>
              <div className="orders-date-range-actions">
                <button
                  type="button"
                  onClick={() => setIsDateRangePickerOpen(false)}
                  className="rounded-md border border-gray-200 px-2 py-1.5 text-xs font-bold text-gray-700 transition hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSelectToday}
                  className="rounded-md border border-gray-200 px-2 py-1.5 text-xs font-bold text-gray-700 transition hover:bg-gray-100"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={handleApplyDateRange}
                  className="rounded-md bg-[#a79981] px-2 py-1.5 text-xs font-bold text-[#101010] transition hover:bg-[#b9aa91]"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {hasActiveDateRange && (
        <button
          type="button"
          onClick={handleClearDateRange}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#a79981]/50 px-4 py-2 text-sm font-semibold text-[#a79981] transition hover:bg-[#a79981] hover:text-[#101010]"
        >
          <MdClose size={18} />
          Reset
        </button>
      )}
    </div>
  );
};

export default OrderDateRangeFilter;
