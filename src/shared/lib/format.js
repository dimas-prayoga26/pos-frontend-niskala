// Display formatting shared by all features (Indonesian rupiah, initials).
export const getBgColor = () => {
  const bgarr = [
    "#b73e3e",
    "#5b45b0",
    "#7f167f",
    "#735f32",
    "#1d2569",
    "#285430",
    "#f6b100",
    "#025cca",
    "#be3e3f",
    "#02ca3a",
  ];
  const randomBg = Math.floor(Math.random() * bgarr.length);
  const color = bgarr[randomBg];
  return color;
};

export const getAvatarName = (name) => {
  if(!name) return "";

  return name.split(" ").map(word => word[0]).join("").toUpperCase();

}

export const formatCurrency = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

export const formatReceiptCurrency = (value) =>
  `Rp ${Math.round(Number(value) || 0).toLocaleString("id-ID")}`;

export const normalizeNominalInput = (value) =>
  String(value ?? "").replace(/\D/g, "");

export const formatNominalInput = (value) => {
  const digitsOnly = normalizeNominalInput(value);

  return digitsOnly ? Number(digitsOnly).toLocaleString("id-ID") : "";
};
