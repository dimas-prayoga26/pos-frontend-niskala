// Period filter of the Belanja page (Area Filter Global): a date range sent as
// ?from=&to= (YYYY-MM-DD, both days included) to the history lists. Days are
// on the Jakarta calendar, like the orders and the server.
import { getJakartaDateKey } from "../../../shared/lib/dates";

export const PERIOD_OPTIONS = [
  { key: "today", label: "Hari Ini" },
  { key: "week", label: "Minggu Ini" },
  { key: "month", label: "Bulan Ini" },
  { key: "year", label: "Tahun Ini" },
  { key: "all", label: "Semua Waktu" },
  { key: "custom", label: "Custom Date" },
];
export const DEFAULT_PERIOD = "month";

// Calendar days as UTC dates, so the arithmetic ignores the browser time zone.
const day = (year, monthIndex, date) => new Date(Date.UTC(year, monthIndex, date));
const dateKey = (date) => date.toISOString().slice(0, 10);

// { from, to } of a period around today (Jakarta); the week runs Monday to
// Sunday. "all" has no limits; "custom" takes the picked days (swapped when
// reversed, open-ended when one is empty).
export const periodRange = (period, custom = {}, today = new Date()) => {
  const todayKey = getJakartaDateKey(today);
  const [year, month, date] = todayKey.split("-").map(Number);
  if (period === "today") return { from: todayKey, to: todayKey };
  if (period === "week") {
    const monday = day(year, month - 1, date - ((day(year, month - 1, date).getUTCDay() + 6) % 7));
    const sunday = day(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 6);
    return { from: dateKey(monday), to: dateKey(sunday) };
  }
  if (period === "month") return { from: dateKey(day(year, month - 1, 1)), to: dateKey(day(year, month, 0)) };
  if (period === "year") return { from: `${year}-01-01`, to: `${year}-12-31` };
  if (period === "custom") {
    const [from, to] = custom.from && custom.to && custom.from > custom.to ? [custom.to, custom.from] : [custom.from, custom.to];
    return { ...(from && { from }), ...(to && { to }) };
  }
  return {};
};

// The range as query params: only the ends that are set.
export const rangeParams = (range = {}) => ({ ...(range.from && { from: range.from }), ...(range.to && { to: range.to }) });

const longDate = (key) =>
  new Date(`${key}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

// "1 Okt 2026 – 31 Okt 2026", "Sejak 1 Okt 2026", "Semua waktu".
export const rangeLabel = (range = {}) => {
  if (range.from && range.to) return range.from === range.to ? longDate(range.from) : `${longDate(range.from)} – ${longDate(range.to)}`;
  if (range.from) return `Sejak ${longDate(range.from)}`;
  if (range.to) return `Sampai ${longDate(range.to)}`;
  return "Semua waktu";
};
