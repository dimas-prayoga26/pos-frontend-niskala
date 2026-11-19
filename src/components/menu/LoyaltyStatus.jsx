import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { getLoyaltyCustomer, redeemLoyaltyReward } from "../../https";
import { formatCurrency } from "../../utils";

// Loyalty stamp of the phone typed in the cart. The stamp itself is given
// by pos-backend after the order is saved; here the cashier sees the card
// and hands over a ready reward.
const MIN_DIGITS = 10;
const DEBOUNCE_MS = 500;

const useDebounced = (value, delay) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
};

const errorMessage = (error) => error?.response?.data?.message || "Loyalty tidak tersedia.";

// Text only, on the same box: green for a new number, the Niskala logo
// color (#AFA087) for a registered one.
const NEW_NUMBER_TEXT = "text-green-400";
const REGISTERED_TEXT = "text-[#AFA087]";

const LoyaltyStatus = ({ phone }) => {
  const queryClient = useQueryClient();
  const trimmed = String(phone || "").trim();
  const debouncedPhone = useDebounced(trimmed, DEBOUNCE_MS);
  const enabled = debouncedPhone.replace(/\D/g, "").length >= MIN_DIGITS;
  const queryKey = ["loyalty-customer", debouncedPhone];

  const { data, error, isFetching } = useQuery({
    queryKey,
    queryFn: () => getLoyaltyCustomer(debouncedPhone),
    enabled,
    retry: false,
    staleTime: 0,
  });

  const redeemMutation = useMutation({
    mutationFn: (reward) => redeemLoyaltyReward({ phone: debouncedPhone, rewardStamps: reward.stamps }),
    onSuccess: (_response, reward) => {
      queryClient.invalidateQueries({ queryKey });
      enqueueSnackbar(`${reward.label} ditukar`, { variant: "success" });
    },
    onError: (redeemError) => enqueueSnackbar(errorMessage(redeemError), { variant: "error" }),
  });

  if (!enabled || trimmed !== debouncedPhone) return null;

  const box = "mt-2 rounded-lg bg-[#1a1a1a] px-3 py-2 text-xs";

  if (isFetching && !data) {
    return <p className={`${box} text-[#ababab]`}>Mengecek loyalty…</p>;
  }

  if (error) {
    return <p className={`${box} text-[#ababab]`}>{errorMessage(error)}</p>;
  }

  const loyalty = data?.data?.data;
  if (!loyalty) return null;

  const minimum = Number(loyalty.stamp_min_order_total) || 0;
  const minimumNote = minimum > 1 ? `Stamp untuk order min. ${formatCurrency(minimum)}` : "";

  if (!loyalty.registered) {
    return (
      <p className={`${box} ${NEW_NUMBER_TEXT}`}>
        Nomor baru{minimumNote ? ` · ${minimumNote}` : ""}
      </p>
    );
  }

  const { customer, card, next_reward: nextReward, ready_rewards: readyRewards = [] } = loyalty;

  const confirmRedeem = (reward) => {
    if (window.confirm(`Tukar ${reward.label} untuk ${customer.code}?`)) {
      redeemMutation.mutate(reward);
    }
  };

  return (
    <div className={`${box} ${REGISTERED_TEXT}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{customer.code}</span>
        {card && (
          <span className="font-semibold">
            {card.stamps}/{card.slots} stamp
          </span>
        )}
      </div>
      {nextReward && (
        <p className="mt-1">
          {nextReward.remaining} stamp lagi · {nextReward.label}
        </p>
      )}
      {/* One stamp a number a day: no promise of another one today. */}
      {loyalty.daily_limit_reached ? (
        <p className="mt-1">Sudah dapat stamp hari ini</p>
      ) : (
        minimumNote && <p className="mt-1">{minimumNote}</p>
      )}
      {readyRewards.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {readyRewards.map((reward) => (
            <button
              key={reward.stamps}
              type="button"
              disabled={redeemMutation.isPending}
              onClick={() => confirmRedeem(reward)}
              className="rounded-md bg-[#a79981] px-3 py-1.5 font-semibold text-[#101010] disabled:opacity-60"
            >
              Tukar {reward.label}
              {reward.count > 1 ? ` (${reward.count})` : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LoyaltyStatus;
