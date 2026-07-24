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

export const APP_TIME_ZONE = "Asia/Jakarta";

const normalizeDateInput = (value = new Date()) => {
  if (value instanceof Date) return value;

  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
      return new Date(`${trimmedValue}T00:00:00+07:00`);
    }

    if (
      /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(trimmedValue) &&
      !/(Z|[-+]\d{2}:?\d{2})$/.test(trimmedValue)
    ) {
      return new Date(`${trimmedValue.replace(" ", "T")}+07:00`);
    }
  }

  return new Date(value);
};

const getJakartaParts = (value = new Date()) => {
  const date = normalizeDateInput(value);

  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(date)
    .reduce((parts, part) => {
      if (part.type !== "literal") {
        parts[part.type] = part.value;
      }

      return parts;
    }, {});
};

export const getJakartaDateKey = (value = new Date()) => {
  const parts = getJakartaParts(value);

  if (!parts) return "";

  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const formatJakartaTime = (value = new Date(), options = {}) => {
  const parts = getJakartaParts(value);

  if (!parts) return "-";

  return Object.prototype.hasOwnProperty.call(options, "second") &&
    options.second === undefined
    ? `${parts.hour}:${parts.minute}`
    : `${parts.hour}:${parts.minute}:${parts.second}`;
};

export const formatJakartaDate = (value = new Date(), options = {}) => {
  const date = normalizeDateInput(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-US", {
    timeZone: APP_TIME_ZONE,
    month: "long",
    day: "2-digit",
    year: "numeric",
    ...options,
  });
};

export const formatJakartaDateTime = (value = new Date()) => {
  const date = normalizeDateInput(value);

  if (Number.isNaN(date.getTime())) return "-";

  return `${formatJakartaDate(date)} ${formatJakartaTime(date, {
    second: undefined,
  })}`;
};

export const formatJakartaReceiptDateTime = (value = new Date()) => {
  const parts = getJakartaParts(value);

  if (!parts) return "-";

  return `${parts.day}/${parts.month}/${parts.year.slice(-2)} ${parts.hour}:${parts.minute}`;
};

export const formatJakartaReceiptDate = (value) => {
  const parts = getJakartaParts(value);

  if (!parts) return value || "-";

  return `${parts.day}/${parts.month}/${parts.year}`;
};

export const getOrderReceivedAmount = (order) => {
  const totalWithTax = Number(order?.bills?.totalWithTax) || 0;

  if (!order?.cateringDetails) return totalWithTax;

  const paymentPlan = order.cateringDetails.paymentPlan || "Full";
  const isPaid = Boolean(order.cateringDetails.isPaid);

  if (paymentPlan !== "DP" || isPaid) return totalWithTax;

  return Number(order.cateringDetails.dp ?? order.bills?.dp ?? 0) || 0;
};

export const formatDate = (date) => {
  return formatJakartaDate(date);
};

export const formatDateAndTime = (date) => {
  return formatJakartaDateTime(date);
}
