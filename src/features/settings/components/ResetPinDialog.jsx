import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { resetLoyaltyMemberPin } from "../api";

// Member Stamp Card → Reset PIN, asked first: the member's PIN goes back to
// the last 4 digits of their number, and they set a new one on their next
// visit to the card page. phone: as shown in the table (08...).
const ResetPinDialog = ({ member, phone, onClose }) => {
  const queryClient = useQueryClient();
  const firstPin = String(member.customer?.phone || "").slice(-4);
  const mutation = useMutation({
    mutationFn: () => resetLoyaltyMemberPin(member.id),
    onSuccess: () => {
      enqueueSnackbar(`PIN ${phone} direset.`, { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["loyalty-members"] });
      onClose();
    },
    onError: (error) => {
      enqueueSnackbar(error?.response?.data?.message || "PIN gagal direset.", { variant: "error" });
    },
  });
  const close = () => {
    if (!mutation.isPending) onClose();
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !mutation.isPending) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mutation.isPending, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-pin-title"
        className="w-full max-w-md rounded-lg bg-[#262626] p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="reset-pin-title" className="text-xl font-bold text-[#f5f5f5]">
          Reset PIN member?
        </h3>
        <p className="mt-3 text-sm leading-6 text-[#ababab]">
          PIN <span className="font-bold text-[#f5f5f5]">{phone}</span>
          {member.customer?.name ? ` (${member.customer.name})` : ""} kembali ke 4 angka terakhir nomor HP:{" "}
          <span className="font-bold text-[#f5f5f5]">{firstPin}</span>. Pelanggan membuat PIN baru saat membuka
          kartu.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={close}
            disabled={mutation.isPending}
            className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5] disabled:opacity-60"
          >
            Batal
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="rounded-lg bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010] disabled:opacity-60"
          >
            {mutation.isPending ? "Mereset..." : "Reset PIN"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetPinDialog;
