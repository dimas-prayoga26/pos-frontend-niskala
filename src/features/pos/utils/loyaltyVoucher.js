// The QR on the back of a stamp card (loyalty app RewardVoucher):
// "NSKV1.<card number>.<stamps>.<time slot>.<signature>", a new one every
// minute. Scanned with the camera, or typed into Nomor Telepon by a scanner
// gun; pos-backend asks the loyalty app whose it is and whether its reward
// can be handed over (an old one is refused: "QR ini sudah berganti").
export const LOYALTY_VOUCHER_PATTERN = /^NSKV1\.[A-Za-z0-9-]+\.\d+\.\d+\.[0-9a-f]{16}$/i;

export const isLoyaltyVoucherCode = (text) => LOYALTY_VOUCHER_PATTERN.test(String(text ?? "").trim());

// The loyalty app keeps numbers as 62…; the cashier types them 08…
export const localPhone = (phone) => {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits.startsWith("62") ? `0${digits.slice(2)}` : digits;
};
