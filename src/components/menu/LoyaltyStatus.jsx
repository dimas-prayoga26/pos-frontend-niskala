import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { MdRedeem } from "react-icons/md";
import { useDispatch, useSelector } from "react-redux";
import { getCategories, getLoyaltyCustomer, getLoyaltyProgram, getMenuItems } from "../../https";
import { formatCurrency } from "../../utils";
import { addItems, removeLoyaltyItemsNotFor } from "../../features/pos/cartSlice";
import { buildMenuCatalog } from "../../features/pos/utils/menuCatalog";
import useLoyaltyEnabled from "../../shared/lib/useLoyaltyEnabled";
import {
  buildLoyaltyRewardLine,
  findLoyaltyRewardMenu,
  loyaltyLinesOf,
} from "../../features/pos/utils/loyaltyReward";

// Loyalty stamp of the phone typed in the cart. The stamp itself is given
// by pos-backend after the order is saved. Tukar puts the reward's promo
// menu (Kategori Promo, marked for its stamp) in the order details, where the
// coffee / rice bowl is picked; the reward is redeemed when the order is saved.
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
  const dispatch = useDispatch();
  const cart = useSelector((state) => state.cart);
  const trimmed = String(phone || "").trim();
  const debouncedPhone = useDebounced(trimmed, DEBOUNCE_MS);
  const enabled = debouncedPhone.replace(/\D/g, "").length >= MIN_DIGITS;

  // No loyalty key (Pengaturan → API), or the stamp card off: the number is
  // not looked up at all.
  const loyaltyApi = useLoyaltyEnabled();
  const programQuery = useQuery({
    queryKey: ["loyalty-program"],
    queryFn: getLoyaltyProgram,
    enabled: loyaltyApi.enabled,
    retry: false,
  });
  const programActive = programQuery.data?.data?.data?.active === true;

  const { data, error, isFetching } = useQuery({
    queryKey: ["loyalty-customer", debouncedPhone],
    queryFn: () => getLoyaltyCustomer(debouncedPhone),
    enabled: enabled && programActive,
    retry: false,
    staleTime: 0,
  });
  // The POS catalog (shared with the menu grid): where the reward promos are.
  const { data: categoriesRes } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
    placeholderData: keepPreviousData,
  });
  const { data: menuItemsRes } = useQuery({
    queryKey: ["menu-items"],
    queryFn: () => getMenuItems(),
    placeholderData: keepPreviousData,
  });
  const catalog = useMemo(
    () => buildMenuCatalog(categoriesRes?.data?.data || [], menuItemsRes?.data?.data || [], false),
    [categoriesRes, menuItemsRes]
  );

  // A reward belongs to the number it was claimed for, and goes when
  // loyalty is gone or the stamp card is switched off.
  const programOff = (loyaltyApi.known && !loyaltyApi.enabled) || (programQuery.isSuccess && !programActive);
  useEffect(() => {
    dispatch(removeLoyaltyItemsNotFor(programOff ? "" : trimmed));
  }, [dispatch, trimmed, programOff]);

  const box = "mt-2 rounded-lg bg-[#1a1a1a] px-3 py-2 text-xs";

  // Loyalty off in Pengaturan → API: said, greyed out, nothing looked up.
  if (loyaltyApi.known && !loyaltyApi.enabled) {
    return enabled && trimmed === debouncedPhone ? <p className={`${box} text-[#777]`}>Loyalty nonaktif.</p> : null;
  }
  if (!loyaltyApi.enabled || !enabled || trimmed !== debouncedPhone || programOff) return null;

  if (programQuery.isError || error) {
    return <p className={`${box} text-[#ababab]`}>{errorMessage(programQuery.error || error)}</p>;
  }

  if (programQuery.isPending || (isFetching && !data)) {
    return <p className={`${box} text-[#ababab]`}>Mengecek loyalty…</p>;
  }

  const loyalty = data?.data?.data;
  // Switched off between the two answers: nothing to show either.
  if (!loyalty || loyalty.program_active === false) return null;

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

  const giveReward = (reward, rewardMenu) => {
    dispatch(
      addItems(
        buildLoyaltyRewardLine({ reward, ...rewardMenu, catalog, phone: debouncedPhone, cart })
      )
    );
    enqueueSnackbar(
      rewardMenu.menu.bundleChoices?.length
        ? `🎁 ${rewardMenu.menu.name} masuk pesanan · pilih menunya di Order Details`
        : `🎁 ${rewardMenu.menu.name} masuk pesanan`,
      { variant: "success" }
    );
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
          {readyRewards.map((reward) => {
            const left = (Number(reward.count) || 0) - loyaltyLinesOf(cart, reward.stamps).length;
            const rewardMenu = findLoyaltyRewardMenu(catalog, reward.promo_menu_item_id);

            // No Promo loyalty menu linked to it yet (Program Promo).
            if (!rewardMenu) {
              return (
                <span
                  key={reward.stamps}
                  className="inline-flex items-center gap-1 rounded-md border border-dashed border-[#AFA087]/50 px-3 py-1.5"
                >
                  <MdRedeem size={14} />
                  {reward.label} siap · menu promonya belum ada
                </span>
              );
            }

            // Already in the order: shown, not offered again.
            if (left <= 0) {
              return (
                <span
                  key={reward.stamps}
                  className="inline-flex items-center gap-1 rounded-md border border-[#AFA087]/50 px-3 py-1.5 font-semibold"
                >
                  <MdRedeem size={14} />
                  {reward.label} di pesanan
                </span>
              );
            }

            return (
              <button
                key={reward.stamps}
                type="button"
                onClick={() => giveReward(reward, rewardMenu)}
                className="inline-flex items-center gap-1 rounded-md bg-[#a79981] px-3 py-1.5 font-semibold text-[#101010] transition hover:bg-[#b9aa91]"
              >
                <MdRedeem size={14} />
                Tukar {reward.label}
                {left > 1 ? ` (${left})` : ""}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LoyaltyStatus;
