import React, { useState, useEffect } from "react";
import Metrics from "../components/dashboard/Metrics";
import RecentOrders from "../components/dashboard/RecentOrders";
import StockManagement from "../components/dashboard/StockManagement";
import MenuManagement from "../components/dashboard/MenuManagement";
import RecapManagement from "../components/dashboard/RecapManagement";
import SettingsManagement from "../components/dashboard/SettingsManagement";
import { useSelector } from "react-redux";

const Dashboard = () => {
  const userRole = useSelector((state) => state.user.role);
  const isAdmin = userRole?.toLowerCase() === "admin";
  const tabs = isAdmin
    ? [
        { key: "metrics", label: "Metrik" },
        { key: "orders", label: "Pesanan" },
        { key: "stock", label: "Stok" },
        { key: "menu", label: "Menu" },
        { key: "recap", label: "Rekap" },
        { key: "setting", label: "Pengaturan" },
      ]
    : [
        { key: "metrics", label: "Metrik" },
        { key: "orders", label: "Pesanan" },
        { key: "stock", label: "Stok" },
        { key: "recap", label: "Rekap" },
      ];

  useEffect(() => {
    document.title = "POS | Admin Dashboard"
  }, [])

  const [activeTab, setActiveTab] = useState("metrics");

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
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
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
