import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getLoyaltyMembers, getLoyaltyRedemptions, getLoyaltyStamps } from "../api";
import { formatJakartaReceiptDate, formatJakartaReceiptDateTime } from "../../../shared/lib/dates";

const PER_PAGE = 20;
const SEARCH_DELAY_MS = 400;
const cellClass = "px-3 py-2.5";

const errorMessage = (error) => error?.response?.data?.message || "Data stamp card gagal dimuat.";

// Stored 6281234567890, shown as the cashier types it: 081234567890.
const localPhone = (phone) => (phone ? String(phone).replace(/^62/, "0") : "-");
const orderCode = (order) => (order ? order.code || `#${order.id}` : null);

const CustomerCell = ({ customer }) => (
  <td className={cellClass}>
    <span className="block font-semibold">{localPhone(customer?.phone)}</span>
    <span className="text-xs text-[#ababab]">{[customer?.code, customer?.name].filter(Boolean).join(" · ")}</span>
  </td>
);

const CARD_STATUS = { completed: "Penuh", redeemed: "Selesai", expired: "Kedaluwarsa" };

// Dashboard → Member Stamp Card (admin, loyalty on). Member (first, opens by
// default): every member, most stamps first, with all the stamps they have
// earned. Stamp Masuk and Hadiah, newest first: the stamps given
// (loyalty_stamps, each with the order that earned it) and the rewards handed
// over (loyalty_redemptions, with the order they went out in).
const VIEWS = [
  {
    key: "members",
    label: "Member",
    queryKey: "loyalty-members",
    fetch: getLoyaltyMembers,
    total: (count) => `${count} member`,
    empty: "Belum ada member.",
    columns: ["Pelanggan", "Total Stamp", "Kartu Sekarang", "Expired", "Hadiah", "Stamp Terakhir"],
    renderRow: (row) => (
      <>
        <CustomerCell customer={row.customer} />
        <td className={cellClass}>
          <span className="block text-base font-bold">{row.total_stamps}</span>
          <span className="text-xs text-[#ababab]">{row.cards} kartu</span>
        </td>
        <td className={cellClass}>
          {row.card ? (
            <>
              <span className="block">
                {row.card.stamps}/{row.card.slots}
                {CARD_STATUS[row.card.status] ? ` · ${CARD_STATUS[row.card.status]}` : ""}
              </span>
              <span className="text-xs text-[#ababab]">{row.card.number}</span>
            </>
          ) : (
            "-"
          )}
        </td>
        {/* Valid until (end of that day), counted from the card's first stamp: none before it. */}
        <td className={`${cellClass} whitespace-nowrap`}>
          {row.card?.expires_at ? (
            <span className={new Date(row.card.expires_at) < new Date() ? "font-semibold text-red-300" : ""}>
              {formatJakartaReceiptDate(row.card.expires_at)}
            </span>
          ) : (
            "-"
          )}
        </td>
        <td className={cellClass}>
          <span className="block">{row.rewards_redeemed} ditukar</span>
          <span className={`text-xs ${row.rewards_ready > 0 ? "font-semibold text-[#AFA087]" : "text-[#ababab]"}`}>
            {row.rewards_ready} siap ditukar
          </span>
        </td>
        <td className={`${cellClass} whitespace-nowrap`}>
          {row.last_stamp_at ? formatJakartaReceiptDateTime(row.last_stamp_at) : <span className="text-[#ababab]">Belum ada</span>}
        </td>
      </>
    ),
  },
  {
    key: "stamps",
    label: "Stamp Masuk",
    queryKey: "loyalty-stamps",
    fetch: getLoyaltyStamps,
    total: (count) => `${count} stamp diberikan`,
    empty: "Belum ada stamp yang diberikan.",
    columns: ["Waktu", "Pelanggan", "Stamp", "Nota", "Kasir"],
    renderRow: (row) => (
      <>
        <td className={`${cellClass} whitespace-nowrap`}>{formatJakartaReceiptDateTime(row.stamped_at)}</td>
        <CustomerCell customer={row.customer} />
        <td className={cellClass}>
          <span className="block">Stamp ke-{row.stamp_number}</span>
          <span className="text-xs text-[#ababab]">{row.card_number}</span>
        </td>
        {/* Given without an order (loyalty:give-stamps): no nota. */}
        <td className={`${cellClass} whitespace-nowrap`}>
          {orderCode(row.order) || <span className="text-[#ababab]">Tanpa nota</span>}
        </td>
        <td className={cellClass}>{row.cashier || "-"}</td>
      </>
    ),
  },
  {
    key: "redemptions",
    label: "Hadiah",
    queryKey: "loyalty-redemptions",
    fetch: getLoyaltyRedemptions,
    total: (count) => `${count} hadiah ditukar`,
    empty: "Belum ada hadiah yang ditukar.",
    columns: ["Waktu", "Pelanggan", "Hadiah", "Menu", "Nota", "Kasir"],
    renderRow: (row) => (
      <>
        <td className={`${cellClass} whitespace-nowrap`}>{formatJakartaReceiptDateTime(row.redeemed_at)}</td>
        <CustomerCell customer={row.customer} />
        <td className={cellClass}>
          Stamp ke-{row.reward?.stamps} · {row.reward?.label}
        </td>
        <td className={cellClass}>{row.menu_name || "-"}</td>
        <td className={`${cellClass} whitespace-nowrap`}>{orderCode(row.order) || "-"}</td>
        <td className={cellClass}>{row.cashier || "-"}</td>
      </>
    ),
  },
];

export default function MemberStampCard() {
  const [viewKey, setViewKey] = useState(VIEWS[0].key);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const view = VIEWS.find((candidate) => candidate.key === viewKey);

  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const listQuery = useQuery({
    queryKey: [view.queryKey, { page, q }],
    queryFn: () => view.fetch({ page, perPage: PER_PAGE, q }),
    // Keeps the page shown while the next loads, never the other tab's rows.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[0] === view.queryKey ? keepPreviousData(previous) : undefined,
    retry: false,
  });
  const list = listQuery.data?.data?.data;
  const rows = list?.data || [];
  const meta = list?.meta || { page: 1, last_page: 1, total: 0 };

  return (
    <section aria-labelledby="member-stamp-card-title" className="container mx-auto rounded-lg bg-[#262626] p-4 text-[#f5f5f5]">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 id="member-stamp-card-title" className="text-xl font-semibold">
            Member Stamp Card
          </h2>
          <p className="mt-1 text-sm text-[#ababab]">{list ? view.total(meta.total) : " "}</p>
        </div>
        <div role="group" aria-label="Jenis data stamp card" className="flex w-fit rounded-lg bg-[#1f1f1f] p-1">
          {VIEWS.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={viewKey === option.key}
              onClick={() => {
                setViewKey(option.key);
                setPage(1);
              }}
              className={`rounded-md px-4 py-2 text-sm font-bold ${
                viewKey === option.key ? "bg-[#a79981] text-[#101010]" : "text-[#ababab] hover:text-[#f5f5f5]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Cari nomor HP, kode, atau nama"
          aria-label="Cari"
          className="w-full rounded-lg bg-[#1f1f1f] px-4 py-2 text-sm outline-none sm:w-80"
        />
      </div>

      <div className="mt-3 overflow-auto rounded-lg border border-[#333]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#202020] text-[#ababab]">
            <tr>
              {view.columns.map((column) => (
                <th key={column} className={cellClass}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-[#333]">
                {view.renderRow(row)}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={view.columns.length} className={`${cellClass} py-6 text-center text-[#ababab]`}>
                  {listQuery.isError ? (
                    <span role="alert" className="text-red-300">
                      {errorMessage(listQuery.error)}
                    </span>
                  ) : !list ? (
                    "Memuat data..."
                  ) : (
                    view.empty
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {meta.last_page > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <button
            type="button"
            onClick={() => setPage((current) => current - 1)}
            disabled={meta.page <= 1 || listQuery.isFetching}
            className="rounded-lg bg-[#333] px-3 py-1.5 font-semibold disabled:opacity-40"
          >
            Sebelumnya
          </button>
          <span className="text-[#ababab]">
            {meta.page} / {meta.last_page}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => current + 1)}
            disabled={meta.page >= meta.last_page || listQuery.isFetching}
            className="rounded-lg bg-[#333] px-3 py-1.5 font-semibold disabled:opacity-40"
          >
            Berikutnya
          </button>
        </div>
      )}
    </section>
  );
}
