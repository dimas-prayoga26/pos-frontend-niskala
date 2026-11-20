import { useMemo, useState, useEffect } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { MdOutlineSettings } from "react-icons/md";
import MenuTab from "../components/MenuTab";
import MetricsTab from "../components/MetricsTab";
import { ShoppingPage, StockManagement, usePurchaseDraftCount } from "../../inventory";
import RecapManagement from "../../../components/dashboard/RecapManagement";
import { SettingsManagement } from "../../settings";
import { useSelector } from "react-redux";
import { getStockItems } from "../api";

// One tab of the dashboard bar: underlined in the brand colour when open.
const tabClass = (isActive) =>
  `whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors md:px-5 md:text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#d6c7ae] ${
    isActive ? "border-[#a79981] text-[#f5f5f5]" : "border-transparent text-[#ababab] hover:text-[#f5f5f5]"
  }`;

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

  // Metrik holds Ringkasan and Menu Paling Laku, Menu holds Daftar Menu and
  // Program Promo; Pengaturan is the gear at the end of the bar. Menu and
  // Pengaturan: admins only.
  const tabs = [
    { key: "metrics", label: "Metrik" },
    { key: "stock", label: "Stok Bahan", badge: lowStockCount },
    { key: "shopping", label: "Belanja", badge: draftCount },
    ...(isAdmin ? [{ key: "menu", label: "Menu" }] : []),
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
      <div className="container mx-auto mb-6 pt-6 lg:pt-8">
        <nav
          aria-label="Menu dashboard"
          className="flex overflow-x-auto scrollbar-hide shadow-[inset_0_-1px_0_#333]"
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-current={activeTab === tab.key ? "page" : undefined}
              className={`flex items-center gap-2 ${tabClass(activeTab === tab.key)}`}
              onClick={() => handleTabClick(tab.key)}
            >
              {tab.label}
              {/* Only when something waits: bahan to restock, draft nota to post. */}
              {tab.badge > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold leading-none text-white">
                  {tab.badge > 99 ? "99+" : tab.badge}
                </span>
              )}
            </button>
          ))}
          {isAdmin && (
            <button
              type="button"
              aria-label="Pengaturan"
              title="Pengaturan"
              aria-current={activeTab === "setting" ? "page" : undefined}
              className={`ml-auto ${tabClass(activeTab === "setting")}`}
              onClick={() => handleTabClick("setting")}
            >
              <MdOutlineSettings className="text-xl" />
            </button>
          )}
        </nav>
      </div>

      {activeTab === "metrics" && <MetricsTab />}
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
        <MenuTab
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
