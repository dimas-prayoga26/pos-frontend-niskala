import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { MdHistory, MdRedeem } from "react-icons/md";
import { getLoyaltyProgram, getMenuItems, updateLoyaltyProgram, updateLoyaltyReward } from "../api";
import { formatCurrency } from "../../../shared/lib/format";
import RedemptionHistoryDialog from "./RedemptionHistoryDialog";

const errorMessage = (error, fallback) => error?.response?.data?.message || fallback;

const Switch = ({ checked, onChange, label, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
      checked ? "bg-[#AFA087]" : "bg-[#3a3a3a]"
    }`}
  >
    <span
      className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
        checked ? "translate-x-6" : "translate-x-1"
      }`}
    />
  </button>
);

// Program Promo: the promo programs, switched on and off. For
// now the stamp card (loyalty app): off, the cashier sees no stamp card, no
// order earns a stamp and no reward is given (the stamps stay). Each reward
// is linked here to the Promo loyalty menu (Menu → Kategori Promo, Jenis
// promo) its Tukar puts in the order: the link the loyalty API keeps.
export default function PromoProgramSettings() {
  const queryClient = useQueryClient();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const closeHistory = useCallback(() => setIsHistoryOpen(false), []);
  const programQuery = useQuery({
    queryKey: ["loyalty-program"],
    queryFn: getLoyaltyProgram,
    retry: false,
  });
  const program = programQuery.data?.data?.data;
  // The menus a reward can give: Kategori Promo menus set as Promo loyalty.
  const { data: menuItemsRes } = useQuery({
    queryKey: ["menu-items"],
    queryFn: () => getMenuItems(),
  });
  const promoMenus = (menuItemsRes?.data?.data || []).filter((menu) => menu.isLoyaltyPromo);

  // Every change answers with the whole program.
  const onSaved = (response, message) => {
    queryClient.setQueryData(["loyalty-program"], response);
    queryClient.invalidateQueries({ queryKey: ["loyalty-customer"] });
    enqueueSnackbar(message, { variant: "success" });
  };
  const programMutation = useMutation({
    mutationFn: updateLoyaltyProgram,
    onSuccess: (response, { active }) => onSaved(response, active ? "Stamp Card dinyalakan." : "Stamp Card dimatikan."),
    onError: (error) => enqueueSnackbar(errorMessage(error, "Gagal mengubah Stamp Card."), { variant: "error" }),
  });
  const rewardMutation = useMutation({
    mutationFn: updateLoyaltyReward,
    onSuccess: (response, patch) =>
      onSaved(
        response,
        "promoMenuItemId" in patch
          ? "Menu promo hadiah disimpan."
          : patch.active
            ? "Hadiah dinyalakan."
            : "Hadiah dimatikan."
      ),
    onError: (error) => enqueueSnackbar(errorMessage(error, "Gagal mengubah hadiah."), { variant: "error" }),
  });

  if (programQuery.isPending) {
    return <p className="rounded-lg bg-[#1f1f1f] p-6 text-center text-sm text-[#ababab]">Memuat program promo...</p>;
  }
  if (programQuery.isError || !program) {
    return (
      <p role="alert" className="rounded-lg bg-[#1f1f1f] p-4 text-red-300">
        {errorMessage(programQuery.error, "Program promo gagal dimuat.")}{" "}
        <button type="button" onClick={() => programQuery.refetch()} className="underline">
          Coba lagi
        </button>
      </p>
    );
  }

  const { rules = {}, rewards = [] } = program;
  const isBusy = programMutation.isPending || rewardMutation.isPending;

  return (
    <section aria-label={program.name} className="rounded-lg bg-[#1f1f1f] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#AFA087]/15 text-[#AFA087]">
            <MdRedeem size={20} />
          </span>
          <div>
            <h3 className="text-lg font-bold text-[#f5f5f5]">{program.name}</h3>
            <p className="mt-1 text-sm text-[#ababab]">
              1 stamp per nota ≥ {formatCurrency(rules.min_order_total || 0)}
              {rules.max_stamps_per_day ? ` · maks ${rules.max_stamps_per_day} stamp/hari` : ""}
              {rules.stamps_per_card ? ` · ${rules.stamps_per_card} stamp per kartu` : ""}
            </p>
            {!program.active && (
              <p className="mt-1 text-sm font-semibold text-amber-300">Nonaktif: kasir tidak memberi stamp maupun hadiah.</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#333] px-3 py-1.5 text-sm font-semibold text-[#f5f5f5] transition hover:bg-[#3d3d3d]"
          >
            <MdHistory size={16} />
            Riwayat
          </button>
          <Switch
            checked={Boolean(program.active)}
            onChange={(active) => programMutation.mutate({ active })}
            label={program.name}
            disabled={isBusy}
          />
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-[#333]">
        <div className="hidden items-center gap-3 bg-[#262626] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#ababab] sm:flex">
          <span className="flex-1">Hadiah</span>
          <span className="w-64">Menu promo loyalty</span>
          <span className="w-12 text-right">Aktif</span>
        </div>
        <ul aria-label="Hadiah">
          {rewards.map((reward) => {
            const name = `Stamp ke-${reward.stamps} · ${reward.label}`;
            const linked = promoMenus.some((menu) => Number(menu.id) === Number(reward.promo_menu_item_id));

            return (
              <li
                key={reward.id}
                aria-label={name}
                className="flex flex-col gap-2 border-t border-[#333] px-4 py-3 sm:flex-row sm:items-center sm:gap-3"
              >
                <span className={`flex-1 text-sm font-semibold ${reward.active ? "text-[#f5f5f5]" : "text-[#777]"}`}>
                  {name}
                </span>
                {/* The Promo loyalty menu its Tukar puts in the order. */}
                <select
                  value={reward.promo_menu_item_id ? String(reward.promo_menu_item_id) : ""}
                  onChange={(event) =>
                    rewardMutation.mutate({
                      id: reward.id,
                      promoMenuItemId: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                  aria-label={`Menu promo ${name}`}
                  disabled={isBusy}
                  className={`w-full rounded-lg bg-[#262626] px-3 py-2 text-sm outline-none sm:w-64 ${
                    reward.promo_menu_item_id ? "text-[#f5f5f5]" : "text-amber-300"
                  }`}
                >
                  <option value="">Belum ada menu</option>
                  {promoMenus.map((menu) => (
                    <option key={menu.id} value={String(menu.id)}>
                      {menu.name}
                    </option>
                  ))}
                  {/* Linked to a menu no longer offered (not on sale, or no longer Promo loyalty). */}
                  {reward.promo_menu_item_id && !linked && (
                    <option value={String(reward.promo_menu_item_id)}>Menu #{reward.promo_menu_item_id} (tidak tersedia)</option>
                  )}
                </select>
                <Switch
                  checked={Boolean(reward.active)}
                  onChange={(active) => rewardMutation.mutate({ id: reward.id, active })}
                  label={name}
                  disabled={isBusy}
                />
              </li>
            );
          })}
          {!rewards.length && <li className="border-t border-[#333] px-4 py-3 text-sm text-[#777]">Belum ada hadiah.</li>}
        </ul>
      </div>
      {!promoMenus.length && (
        <p className="mt-2 text-xs text-amber-300">
          Belum ada menu Promo loyalty: buat di Menu → kategori PROMO, Jenis promo: Promo loyalty.
        </p>
      )}
      {isHistoryOpen && <RedemptionHistoryDialog onClose={closeHistory} />}
    </section>
  );
}
