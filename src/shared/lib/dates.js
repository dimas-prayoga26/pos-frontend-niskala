// All dates are shown in Asia/Jakarta. MySQL strings without an offset
// ("YYYY-MM-DD HH:mm:ss") are interpreted as Jakarta time.
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

export const getJakartaParts = (value = new Date()) => {
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

// "29 Oktober 2026" for a stored day ("YYYY-MM-DD", or the date part of a
// "YYYY-MM-DD HH:mm:ss"), read as written so no time zone shifts the day.
export const formatDayMonthYear = (value) => {
  const key = String(value ?? "").slice(0, 10);

  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(key)) return value ? String(value) : "-";

  return new Date(`${key}T00:00:00Z`).toLocaleDateString("id-ID", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export const formatDate = (date) => {
  return formatJakartaDate(date);
};

export const formatDateAndTime = (date) => {
  return formatJakartaDateTime(date);
}
