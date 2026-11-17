import { useMemo, useState, useEffect } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Metrics from "../../../components/dashboard/Metrics";
import MenuPerformance from "../components/MenuPerformance";
import { ShoppingPage, StockManagement, usePurchaseDraftCount } from "../../inventory";
import MenuManagement from "../../../components/dashboard/MenuManagement";
import RecapManagement from "../../../components/dashboard/RecapManagement";
import { SettingsManagement } from "../../settings";
import { useSelector } from "react-redux";
import { getStockItems } from "../api";

const Dashboard = () => {
  const user = useSelector((state) => state.user);
  const userRole = user.role;
  const isAdmin = userRole?.toLowerCase() === "admin";
  const [activeTab, setActiveTab] = useState("metrics");
  // Bahan baku a Catat Masak is short of ({ stockItemId, unit }): Belanja
  // Bahan opens Tambah Belanja with them. Any tab click drops them.
  const [restockItems, setRestockItems] = useState(null);
  // A recipe bahan the menu form did not find ({ kind, name }): Stok Bahan
  // opens its Tambah form. Any tab click drops it.
  const [createStockItem, setCreateStockItem] = useState(null);

  const { data: stockItemsRes } = useQuery({
    queryKey: ["stock-items"],
    queryFn: getStockItems,
    placeholderData: keepPreviousData,
  });

  // Draft nota waiting for an admin to post them.
  const draftCount = usePurchaseDraftCount();

  // Bahan baku to restock: running low or already at/below the minimum.
  const lowStockCount = useMemo(() => {
    const stockItems = stockItemsRes?.data?.data || [];
    return stockItems.filter((item) => item.status === "HAMPIR HABIS" || item.status === "HARUS ORDER").length;
  }, [stockItemsRes]);

  const tabs = isAdmin
    ? [
        { key: "metrics", label: "Metrik" },
        { key: "menu-performance", label: "Menu Terlaris" },
        { key: "stock", label: "Stok Bahan", badge: lowStockCount },
        { key: "shopping", label: "Belanja", badge: draftCount },
        { key: "menu", label: "Menu" },
        { key: "recap", label: "Rekap" },
        { key: "setting", label: "Pengaturan" },
      ]
    : [
        { key: "metrics", label: "Metrik" },
        { key: "menu-performance", label: "Menu Terlaris" },
        { key: "stock", label: "Stok Bahan", badge: lowStockCount },
        { key: "shopping", label: "Belanja", badge: draftCount },
        { key: "recap", label: "Rekap" },
      ];

  useEffect(() => {
    document.title = "POS | Admin Dashboard"
  }, [])

  const handleTabClick = (tabKey) => {
    setActiveTab(tabKey);
    setRestockItems(null);
    setCreateStockItem(null);
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
      {activeTab === "menu-performance" && <MenuPerformance />}
      {activeTab === "stock" && (
        <StockManagement
          createItem={createStockItem}
          onRestock={(items) => {
            setActiveTab("shopping");
            setRestockItems(items);
          }}
        />
      )}
      {activeTab === "shopping" && <ShoppingPage restockItems={restockItems} />}
      {activeTab === "menu" && isAdmin && (
        <MenuManagement
          onCreateIngredient={(kind, name) => {
            setActiveTab("stock");
            setCreateStockItem({ kind, name });
          }}
        />
      )}
      {activeTab === "recap" && <RecapManagement />}
      {activeTab === "setting" && isAdmin && <SettingsManagement />}
    </div>
  );
};

export default Dashboard;
