// Compatibility barrel for files that still import "../../utils".
// New code imports from shared/lib/* or the owning feature instead.
// Remove once every importer has been migrated (see docs/frontend-architecture.md).
export {
  formatCurrency,
  formatNominalInput,
  formatReceiptCurrency,
  getAvatarName,
  getBgColor,
  normalizeNominalInput,
} from "../shared/lib/format";
export {
  APP_TIME_ZONE,
  formatDate,
  formatDateAndTime,
  formatJakartaDate,
  formatJakartaDateTime,
  formatJakartaReceiptDate,
  formatJakartaReceiptDateTime,
  formatJakartaTime,
  getJakartaDateKey,
} from "../shared/lib/dates";
export {
  getDisplayOrderCode,
  getOrderHppTotal,
  getOrderItemHpp,
  getOrderReceivedAmount,
  getOrdersHppTotal,
} from "../features/orders/utils/orderMetrics";
