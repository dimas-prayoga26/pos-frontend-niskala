import { describe, expect, it } from "vitest";
import {
  getDisplayOrderCode,
  getOrderGrossRevenue,
  getOrderHppTotal,
  getOrderIncomeDeduction,
  getOrderItemHpp,
  getOrderNetRevenue,
  getOrdersGrossRevenueTotal,
  getOrderReceivedAmount,
  getOrdersNetRevenueTotal,
  getOrdersHppTotal,
  isCashPayment,
  isOrderPlatformMatch,
  isQrPayment,
} from "./orderMetrics";

const menuItems = [
  { id: 7, name: "Kopi Uji", hppCost: 0, sizes: [
    { name: "Regular", hppCost: 6000 },
    { name: "Large", hppCost: 8000 },
  ] },
  { id: 9, name: "Roti Uji", hppCost: 5000, sizes: [] },
];

describe("order code", () => {
  it("prefers the server code and falls back to YYMM-id", () => {
    expect(getDisplayOrderCode({ orderId: "2601-0007" })).toBe("2601-0007");
    expect(getDisplayOrderCode({ orderCode: "2601-0008" })).toBe("2601-0008");
    expect(getDisplayOrderCode({ id: 12, orderDate: "2026-01-05 10:00:00" })).toBe("2601-0012");
    expect(getDisplayOrderCode({ id: 3, orderDate: "bad" })).toBe("0003");
  });
});

describe("received amount", () => {
  it("counts the full total except for unpaid DP catering", () => {
    const bills = { totalWithTax: 500000, dp: 150000 };
    expect(getOrderReceivedAmount({ bills })).toBe(500000);
    expect(getOrderReceivedAmount({ bills, cateringDetails: { paymentPlan: "Full" } })).toBe(500000);
    expect(
      getOrderReceivedAmount({ bills, cateringDetails: { paymentPlan: "DP", isPaid: true, dp: 200000 } })
    ).toBe(500000);
    expect(
      getOrderReceivedAmount({ bills, cateringDetails: { paymentPlan: "DP", isPaid: false, dp: 200000 } })
    ).toBe(200000);
    expect(getOrderReceivedAmount({ bills, cateringDetails: { paymentPlan: "DP" } })).toBe(150000);
    expect(getOrderReceivedAmount(null)).toBe(0);
  });
});

describe("revenue breakdown", () => {
  it("rebuilds gross and net revenue from platform and QRIS deductions", () => {
    const onlineQrisOrder = {
      orderType: "Online",
      orderPlatform: "ShopeeFood",
      platformTax: 10000,
      paymentMethod: "QRIS",
      bills: { totalWithTax: 90000 },
    };
    const cashOrder = {
      orderType: "Offline",
      paymentMethod: "Tunai",
      bills: { totalWithTax: 50000 },
    };

    expect(getOrderGrossRevenue(onlineQrisOrder)).toBe(100000);
    expect(getOrderIncomeDeduction(onlineQrisOrder)).toBe(10700);
    expect(getOrderNetRevenue(onlineQrisOrder)).toBe(89300);
    expect(getOrdersGrossRevenueTotal([onlineQrisOrder, cashOrder])).toBe(150000);
    expect(getOrdersNetRevenueTotal([onlineQrisOrder, cashOrder])).toBe(139300);
  });

  it("normalizes payment and platform labels for reporting", () => {
    expect(isCashPayment("Tunai")).toBe(true);
    expect(isCashPayment("cash")).toBe(true);
    expect(isQrPayment("QRIS")).toBe(true);
    expect(isQrPayment("Manual QR Payment")).toBe(true);
    expect(isOrderPlatformMatch({ orderPlatform: "Shopee Food" }, "shopeefood")).toBe(true);
  });
});

describe("HPP", () => {
  it("uses the HPP snapshot stored on the order item first", () => {
    expect(getOrderItemHpp({ hppCost: 4200, name: "Kopi Uji" }, menuItems)).toBe(4200);
    expect(getOrderItemHpp({ hpp_cost: "3100" }, menuItems)).toBe(3100);
  });

  it("falls back to the menu size HPP resolved from ids, keys or variants", () => {
    expect(getOrderItemHpp({ sourceMenuItemId: 7, sizeVariant: "Large" }, menuItems)).toBe(8000);
    expect(getOrderItemHpp({ id: "3-7-Large" }, menuItems)).toBe(8000);
    expect(getOrderItemHpp({ menuItemId: 7, variant: "Regular / Hot" }, menuItems)).toBe(6000);
    expect(getOrderItemHpp({ menuItemId: 7, sizeVariant: "Jumbo" }, menuItems)).toBe(6000);
  });

  it("falls back to the menu HPP by id or by name, else 0", () => {
    expect(getOrderItemHpp({ menuItemId: 9 }, menuItems)).toBe(5000);
    expect(getOrderItemHpp({ name: " roti uji " }, menuItems)).toBe(5000);
    expect(getOrderItemHpp({ name: "Tidak Ada" }, menuItems)).toBe(0);
  });

  it("multiplies by quantity and sums across orders", () => {
    const order = {
      items: [
        { sourceMenuItemId: 7, sizeVariant: "Regular", quantity: 2 },
        { hppCost: 1000, quantity: -1 },
        { menuItemId: 9, quantity: "3" },
      ],
    };
    expect(getOrderHppTotal(order, menuItems)).toBe(27000);
    expect(getOrdersHppTotal([order, { items: [] }, {}], menuItems)).toBe(27000);
  });
});
