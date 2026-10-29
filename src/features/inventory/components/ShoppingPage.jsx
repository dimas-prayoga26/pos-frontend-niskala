import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { getStockItems, getSupplyItems } from "../api";
import ShoppingManagement from "./ShoppingManagement";

const NO_ITEMS = [];

// Dashboard "Belanja" menu: the transactions that bring goods in and take
// saldo out (belanja bahan baku and perlengkapan, draft nota, history). What
// is on hand lives in the "Stok" menu.
const ShoppingPage = () => {
  const userRole = useSelector((state) => state.user.role);
  const isAdmin = userRole?.toLowerCase() === "admin";
  const { data: stockItemsRes } = useQuery({
    queryKey: ["stock-items"],
    queryFn: getStockItems,
    placeholderData: keepPreviousData,
  });
  const { data: supplyItemsRes } = useQuery({
    queryKey: ["supply-items"],
    queryFn: getSupplyItems,
    placeholderData: keepPreviousData,
  });

  return (
    <div className="container mx-auto rounded-lg bg-[#262626] p-4">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-[#f5f5f5]">Belanja</h2>
        <p className="mt-1 text-sm text-[#ababab]">
          Barang masuk dan uang keluar: belanja bahan baku dan perlengkapan, draft nota, dan riwayatnya.
        </p>
      </div>
      <ShoppingManagement
        stockItems={stockItemsRes?.data?.data || NO_ITEMS}
        supplyItems={supplyItemsRes?.data?.data || NO_ITEMS}
        isAdmin={isAdmin}
      />
    </div>
  );
};

export default ShoppingPage;
