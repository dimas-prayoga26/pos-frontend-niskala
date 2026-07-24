import React, { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { MdAccountBalance, MdQrCode2 } from "react-icons/md";
import { formatCurrency } from "../../utils";
import { buildDynamicQRIS, paymentConfig } from "../../utils/qris";

const paymentOptions = [
  {
    value: "QRIS",
    label: "QRIS",
    icon: MdQrCode2,
  },
  {
    value: "Bank Mandiri",
    label: "Bank Mandiri",
    icon: MdAccountBalance,
  },
];

const NonCashPaymentModal = ({
  amount,
  customerName,
  isSubmitting,
  onClose,
  onConfirm,
}) => {
  const canvasRef = useRef(null);
  const [selectedMethod, setSelectedMethod] = useState("QRIS");
  const qrisString = useMemo(() => buildDynamicQRIS(amount), [amount]);
  const roundedAmount = Math.round(Number(amount) || 0);

  useEffect(() => {
    if (selectedMethod !== "QRIS" || !canvasRef.current || !qrisString) return;

    QRCode.toCanvas(canvasRef.current, qrisString, {
      width: 236,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });
  }, [qrisString, selectedMethod]);

  const handleConfirm = () => {
    onConfirm(selectedMethod);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-[#333] bg-[#1f1f1f] text-[#f5f5f5] shadow-2xl shadow-black/60">
        <div className="border-b border-[#333] p-4">
          <h2 className="text-lg font-bold">Pembayaran Non Tunai</h2>
          <p className="mt-1 text-sm text-[#ababab]">
            Pilih QRIS atau transfer Mandiri, lalu buat pesanan setelah customer
            melihat instruksi pembayaran.
          </p>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-2 gap-2">
            {paymentOptions.map((option) => {
              const Icon = option.icon;
              const isActive = selectedMethod === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedMethod(option.value)}
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-bold transition ${
                    isActive
                      ? "bg-[#a79981] text-[#101010]"
                      : "bg-[#161616] text-[#ababab] hover:bg-[#262626] hover:text-white"
                  }`}
                >
                  <Icon size={20} />
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-lg bg-[#161616] p-4">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#a79981]">
                  Total Pembayaran
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {formatCurrency(roundedAmount)}
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-[#333] bg-[#202020] px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-[#a79981]">
                  Customer
                </span>
                <span className="min-w-0 truncate text-right text-sm font-bold text-[#f5f5f5]">
                  {customerName || "Guest"}
                </span>
              </div>
            </div>

            {selectedMethod === "QRIS" ? (
              <div className="mt-4 flex flex-col items-center gap-3">
                <div className="rounded-lg bg-white p-3">
                  {qrisString ? (
                    <canvas ref={canvasRef} />
                  ) : (
                    <div className="flex h-[236px] w-[236px] items-center justify-center text-center text-sm font-semibold text-[#333]">
                      QRIS belum dikonfigurasi
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold">
                    {paymentConfig.qrisMerchantName}
                  </p>
                  <p className="mt-1 text-xs text-[#ababab]">
                    Nominal QRIS sudah dikunci sesuai total pesanan.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3 rounded-lg border border-[#333] bg-[#1f1f1f] p-4">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-[#ababab]">Bank</span>
                  <span className="font-bold">Mandiri</span>
                </div>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-[#ababab]">No. Rekening</span>
                  <span className="font-bold">
                    {paymentConfig.mandiriAccountNumber || "-"}
                  </span>
                </div>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-[#ababab]">Atas Nama</span>
                  <span className="text-right font-bold">
                    {paymentConfig.mandiriAccountName}
                  </span>
                </div>
                <div className="border-t border-[#333] pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#a79981]">
                    Nominal Transfer
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    {formatCurrency(roundedAmount)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-[#333] p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg bg-[#2a2a2a] px-4 py-3 text-sm font-bold text-[#ababab] transition hover:bg-[#333] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="rounded-lg bg-[#a79981] px-4 py-3 text-sm font-bold text-[#101010] transition hover:bg-[#b9aa91] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Membuat..." : "Buat Pesanan"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NonCashPaymentModal;
