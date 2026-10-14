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
  getOrderGrossRevenue,
  getOrderIncomeDeduction,
  getOrderItemHpp,
  getOrderNetRevenue,
  getOrderPlatformDeduction,
  getOrderQrisDeduction,
  getOrderReceivedAmount,
  getOrdersGrossRevenueTotal,
  getOrdersHppTotal,
  getOrdersNetRevenueTotal,
  isCashPayment,
  isOrderPlatformMatch,
  isQrPayment,
  QRIS_FEE_RATE,
} from "../features/orders/utils/orderMetrics";
