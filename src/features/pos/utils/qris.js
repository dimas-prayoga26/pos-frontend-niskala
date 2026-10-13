const viteEnv = import.meta.env || {};

const QRIS_STATIC_STRING =
  viteEnv.VITE_QRIS_STATIC_STRING ||
  "00020101021126610014COM.GO-JEK.WWW01189360091430895812380210G0895812380303UKE51440014ID.CO.QRIS.WWW0215ID10265549651490303UKE5204581253033605802ID5925Niskala Coffee, Vokalis K6015JAKARTA SELATAN61051271062070703A0163044089";

const calculateCRC16 = (value) => {
  let crc = 0xffff;

  for (let index = 0; index < value.length; index += 1) {
    crc ^= value.charCodeAt(index) << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      crc =
        crc & 0x8000
          ? ((crc << 1) ^ 0x1021) & 0xffff
          : (crc << 1) & 0xffff;
    }
  }

  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
};

const parseTLV = (value) => {
  const elements = [];
  let position = 0;

  while (position < value.length) {
    if (position + 4 > value.length) break;

    const tag = value.slice(position, position + 2);
    const length = Number.parseInt(value.slice(position + 2, position + 4), 10);

    if (Number.isNaN(length) || position + 4 + length > value.length) break;

    elements.push({
      tag,
      value: value.slice(position + 4, position + 4 + length),
    });
    position += 4 + length;
  }

  return elements;
};

const makeTLV = (tag, value) =>
  `${tag}${String(value.length).padStart(2, "0")}${value}`;

export const buildDynamicQRIS = (amount) => {
  const normalizedAmount = Math.max(Math.round(Number(amount) || 0), 0);

  if (!normalizedAmount || !QRIS_STATIC_STRING) return "";

  const elements = parseTLV(QRIS_STATIC_STRING);
  const managedTags = new Set(["54", "55", "56", "57", "63"]);
  const output = [];
  let amountInserted = false;

  for (const element of elements) {
    if (managedTags.has(element.tag)) continue;

    if (element.tag === "01") {
      output.push(makeTLV("01", "12"));
      continue;
    }

    if (element.tag === "58" && !amountInserted) {
      output.push(makeTLV("54", String(normalizedAmount)));
      amountInserted = true;
    }

    output.push(makeTLV(element.tag, element.value));
  }

  if (!amountInserted) {
    output.push(makeTLV("54", String(normalizedAmount)));
  }

  const withoutCRC = output.join("");
  const crcInput = `${withoutCRC}6304`;

  return `${crcInput}${calculateCRC16(crcInput)}`;
};

export const paymentConfig = {
  mandiriAccountNumber: viteEnv.VITE_MANDIRI_ACCOUNT_NUMBER || "1570014339999",
  mandiriAccountName:
    viteEnv.VITE_MANDIRI_ACCOUNT_NAME || "FUAD MUHAMAD FAHRUDI",
  qrisMerchantName: "Niskala Coffee",
};
