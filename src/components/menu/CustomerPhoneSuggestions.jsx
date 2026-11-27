import { useQuery } from "@tanstack/react-query";
import { getLoyaltyMembers, getOrderCustomerSuggestions } from "../../https";
import { localPhone } from "../../features/pos/utils/loyaltyVoucher";
import useDebounced from "../../shared/lib/useDebounced";

export default function CustomerPhoneSuggestions({ phone, loyaltyEnabled, onSelect }) {
  const digits = /^[+\d().\s-]+$/.test(phone) ? phone.replace(/\D/g, "") : "";
  const prefix = useDebounced(digits, 300);
  const enabled = digits === prefix && /^\d{6,15}$/.test(prefix);
  const orders = useQuery({
    queryKey: ["customer-suggestions", prefix],
    queryFn: ({ signal }) => getOrderCustomerSuggestions(prefix, signal),
    enabled,
    retry: false,
  });
  const localPrefix = localPhone(prefix);
  const memberPrefix = localPrefix.replace(/^08/, "628");
  const members = useQuery({
    queryKey: ["customer-suggestions-members", memberPrefix],
    queryFn: ({ signal }) => getLoyaltyMembers({ q: memberPrefix, perPage: 10 }, signal),
    enabled: enabled && loyaltyEnabled,
    retry: false,
  });

  if (!enabled) return null;
  const matches = new Map();
  const orderCustomers = orders.data?.data?.data || [];
  const memberCustomers = loyaltyEnabled ? (members.data?.data?.data?.data || []).map(row => row.customer) : [];
  for (const customer of [...orderCustomers, ...memberCustomers]) {
    const fullPhone = localPhone(customer?.phone);
    const name = customer?.name?.trim();
    if (/^\d{10,15}$/.test(fullPhone) && fullPhone.startsWith(localPrefix) && name && !/^guest(-\d+)?$/i.test(name)) {
      matches.set(fullPhone, name);
    }
  }
  const items = [...matches].sort(([a], [b]) => Number(b === localPrefix) - Number(a === localPrefix)).slice(0, 5);
  if (!items.length) {
    if (orders.isPending || (loyaltyEnabled && members.isPending)) return null;
    return <p role="status" className="mt-2 text-xs text-[#ababab]">
      {orders.isError || (loyaltyEnabled && members.isError) ? "Sebagian data pelanggan tidak tersedia." : "Belum ada pelanggan yang cocok."}
    </p>;
  }
  return (
    <ul aria-label="Pelanggan yang cocok" className="mt-1 divide-y divide-[#353535] overflow-hidden rounded-lg border border-[#353535] bg-[#242424]">
      {items.map(([number, name]) => (
        <li key={number}>
          <button type="button" onClick={() => onSelect({ phone: number, name })}
            className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-[#303030] focus-visible:bg-[#303030]">
            <span className="truncate text-sm font-medium text-[#f5f5f5]">{name}</span>
            <span className="text-xs tabular-nums text-[#bdb5a6]">{number}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
