import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { MdRedeem } from "react-icons/md";
import { getLoyaltyProgram, getMenuItems, updateLoyaltyProgram, updateLoyaltyReward } from "../api";
import { formatCurrency } from "../../../shared/lib/format";
import SettingCard from "../../../shared/ui/SettingCard";
import Switch from "../../../shared/ui/Switch";

const errorMessage = (error, fallback) => error?.response?.data?.message || fallback;

// Menu → Promo, above the promos: the stamp card (loyalty app), its rules
// and its rewards; its members, stamps and rewards handed over are under
// Dashboard → Member Stamp Card. Off, the cashier sees no stamp card, no order
// earns a stamp and no reward is given (the stamps stay). The menu each
// reward gives is picked in the promo form (Jenis promo: Hadiah Stamp Card);
// onEditMenu(menuItemId) opens it from its reward's row. disabled: loyalty is
// off in Pengaturan → API; the card stays, greyed out, and asks nothing.
// readOnly (kasir): shown with its switches locked.
export default function PromoProgramSettings({ onEditMenu = null, disabled = false, readOnly = false }) {
  const queryClient = useQueryClient();
  const programQuery = useQuery({
    queryKey: ["loyalty-program"],
    queryFn: getLoyaltyProgram,
    enabled: !disabled,
    retry: false,
  });
  const program = programQuery.data?.data?.data;
  // For the name of the menu each reward gives.
  const { data: menuItemsRes } = useQuery({
    queryKey: ["menu-items"],
    queryFn: () => getMenuItems(),
  });
  const menuNameOf = (menuItemId) =>
    (menuItemsRes?.data?.data || []).find((menu) => Number(menu.id) === Number(menuItemId))?.name;

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
    onSuccess: (response, { active }) => onSaved(response, active ? "Hadiah dinyalakan." : "Hadiah dimatikan."),
    onError: (error) => enqueueSnackbar(errorMessage(error, "Gagal mengubah hadiah."), { variant: "error" }),
  });

  if (disabled) {
    return (
      <div aria-disabled="true" className="opacity-60">
        <SettingCard
          icon={<MdRedeem size={20} />}
          title="Stamp Card"
          warning="Loyalty nonaktif: aktifkan di Pengaturan → API."
          actions={<Switch checked={false} onChange={() => {}} label="Stamp Card" disabled />}
        />
      </div>
    );
  }
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
  const isBusy = readOnly || programMutation.isPending || rewardMutation.isPending;

  return (
    <SettingCard
      icon={<MdRedeem size={20} />}
      title={program.name}
      subtitle={[
        `1 stamp per nota ≥ ${formatCurrency(rules.min_order_total || 0)}`,
        rules.max_stamps_per_day ? `maks ${rules.max_stamps_per_day} stamp/hari` : null,
        rules.stamps_per_card ? `${rules.stamps_per_card} stamp per kartu` : null,
      ]
        .filter(Boolean)
        .join(" · ")}
      warning={program.active ? null : "Nonaktif: kasir tidak memberi stamp maupun hadiah."}
      actions={
        <Switch
          checked={Boolean(program.active)}
          onChange={(active) => programMutation.mutate({ active })}
          label={program.name}
          disabled={isBusy}
        />
      }
    >
      <div className="overflow-hidden rounded-lg border border-[#333]">
        <div className="hidden items-center gap-3 bg-[#262626] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#ababab] sm:flex">
          <span className="flex-1">Hadiah</span>
          <span className="w-64">Menu hadiah</span>
          <span className="w-12 text-right">Aktif</span>
        </div>
        <ul aria-label="Hadiah">
          {rewards.map((reward) => {
            const name = `Stamp ke-${reward.stamps} · ${reward.label}`;
            const menuId = reward.promo_menu_item_id;
            const menuName = menuId ? menuNameOf(menuId) || `Menu #${menuId}` : "";

            return (
              <li
                key={reward.id}
                aria-label={name}
                className="flex flex-col gap-2 border-t border-[#333] px-4 py-3 sm:flex-row sm:items-center sm:gap-3"
              >
                <span className={`flex-1 text-sm font-semibold ${reward.active ? "text-[#f5f5f5]" : "text-[#777]"}`}>
                  {name}
                </span>
                {/* The menu its Tukar puts in the order, picked in its promo form (Ubah). */}
                <span className="flex w-full items-center justify-between gap-2 sm:w-64">
                  <span
                    aria-label={`Menu hadiah ${name}`}
                    className={`truncate text-sm ${menuName ? "text-[#f5f5f5]" : "text-amber-300"}`}
                  >
                    {menuName || "Belum ada menu"}
                  </span>
                  {onEditMenu && menuId && (
                    <button
                      type="button"
                      onClick={() => onEditMenu(menuId)}
                      aria-label={`Ubah menu hadiah ${name}`}
                      className="shrink-0 rounded-md bg-[#333] px-2.5 py-1 text-xs font-semibold text-[#f5f5f5] transition hover:bg-[#3d3d3d]"
                    >
                      Ubah
                    </button>
                  )}
                </span>
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
      {!readOnly && rewards.some((reward) => !reward.promo_menu_item_id) && (
        <p className="mt-2 text-xs text-amber-300">Pilih menunya lewat Tambah Promo → Jenis promo: Hadiah stamp card.</p>
      )}
    </SettingCard>
  );
}
