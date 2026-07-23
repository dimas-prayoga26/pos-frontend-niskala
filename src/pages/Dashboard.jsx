import React, { useMemo, useState, useEffect } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Metrics from "../components/dashboard/Metrics";
import RecentOrders from "../components/dashboard/RecentOrders";
import StockManagement from "../components/dashboard/StockManagement";
import MenuManagement from "../components/dashboard/MenuManagement";
import RecapManagement from "../components/dashboard/RecapManagement";
import SettingsManagement from "../components/dashboard/SettingsManagement";
import { useSelector } from "react-redux";
import { getOrders, getStockItems } from "../https";

const getOrderNumericId = (order) => Number(order?.id || order?._id || 0) || 0;

const Dashboard = () => {
  const user = useSelector((state) => state.user);
  const userRole = user.role;
  const isAdmin = userRole?.toLowerCase() === "admin";
  const orderBadgeStorageKey = `dashboard:last-seen-order:${
    user._id || user.email || userRole || "guest"
  }`;
  const [activeTab, setActiveTab] = useState("metrics");
  const [lastSeenOrderId, setLastSeenOrderId] = useState(() => {
    const storedValue = localStorage.getItem(orderBadgeStorageKey);
    return storedValue === null ? null : Number(storedValue) || 0;
  });

  const { data: ordersRes } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
    placeholderData: keepPreviousData,
  });

  const { data: stockItemsRes } = useQuery({
    queryKey: ["stock-items"],
    queryFn: getStockItems,
    placeholderData: keepPreviousData,
  });

  const orders = ordersRes?.data?.data || [];
  const stockItems = stockItemsRes?.data?.data || [];

  const latestOrderId = useMemo(() => {
    return orders.reduce(
      (latestId, order) => Math.max(latestId, getOrderNumericId(order)),
      0
    );
  }, [orders]);

  const newOrderCount = useMemo(() => {
    if (lastSeenOrderId === null) return 0;

    return orders.filter((order) => getOrderNumericId(order) > lastSeenOrderId)
      .length;
  }, [lastSeenOrderId, orders]);

  const lowStockCount = useMemo(() => {
    return stockItems.filter((item) => item.status === "HAMPIR HABIS").length;
  }, [stockItems]);

  const tabs = isAdmin
    ? [
        { key: "metrics", label: "Metrik" },
        { key: "orders", label: "Pesanan", badge: newOrderCount },
        { key: "stock", label: "Stok", badge: lowStockCount },
        { key: "menu", label: "Menu" },
        { key: "recap", label: "Rekap" },
        { key: "setting", label: "Pengaturan" },
      ]
    : [
        { key: "metrics", label: "Metrik" },
        { key: "orders", label: "Pesanan", badge: newOrderCount },
        { key: "stock", label: "Stok", badge: lowStockCount },
        { key: "recap", label: "Rekap" },
      ];

  useEffect(() => {
    document.title = "POS | Admin Dashboard"
  }, [])

  useEffect(() => {
    const storedValue = localStorage.getItem(orderBadgeStorageKey);
    setLastSeenOrderId(storedValue === null ? null : Number(storedValue) || 0);
  }, [orderBadgeStorageKey]);

  useEffect(() => {
    if (!latestOrderId) return;

    if (lastSeenOrderId === null) {
      localStorage.setItem(orderBadgeStorageKey, String(latestOrderId));
      setLastSeenOrderId(latestOrderId);
      return;
    }

    if (activeTab === "orders" && latestOrderId > lastSeenOrderId) {
      localStorage.setItem(orderBadgeStorageKey, String(latestOrderId));
      setLastSeenOrderId(latestOrderId);
    }
  }, [activeTab, lastSeenOrderId, latestOrderId, orderBadgeStorageKey]);

  const handleTabClick = (tabKey) => {
    setActiveTab(tabKey);

    if (tabKey === "orders") {
      localStorage.setItem(orderBadgeStorageKey, String(latestOrderId));
      setLastSeenOrderId(latestOrderId);
    }
  };

  return (
    <div className="bg-[#1f1f1f] min-h-[calc(100vh-5rem)] overflow-y-auto pb-16">
      <div className="container mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-8 lg:py-14 px-4 md:px-6">
        <div />

        <div className="flex items-center gap-2 md:gap-3 overflow-x-auto w-full lg:w-auto pb-1">
          {tabs.map((tab) => {
            return (
              <button
                key={tab.key}
                className={`
                whitespace-nowrap px-4 md:px-8 py-3 rounded-lg text-[#f5f5f5] font-semibold text-sm md:text-md flex items-center gap-2 ${
                  activeTab === tab.key
                    ? "bg-[#262626]"
                    : "bg-[#1a1a1a] hover:bg-[#262626]"
                }`}
                onClick={() => handleTabClick(tab.key)}
              >
                {tab.label}
                {typeof tab.badge === "number" && (
                  <span
                    className={`ml-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none ${
                      tab.badge > 0
                        ? "bg-red-500 text-white"
                        : "bg-[#3a3a3a] text-[#ababab]"
                    }`}
                  >
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "metrics" && <Metrics />}
      {activeTab === "orders" && <RecentOrders />}
      {activeTab === "stock" && <StockManagement />}
      {activeTab === "menu" && isAdmin && <MenuManagement />}
      {activeTab === "recap" && <RecapManagement />}
      {activeTab === "setting" && isAdmin && <SettingsManagement />}
    </div>
  );
};

export default Dashboard;
