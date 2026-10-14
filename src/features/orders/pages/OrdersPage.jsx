import React, { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import BackButton from "../../../shared/ui/BackButton";
import BottomNav from "../../../shared/ui/BottomNav";
import { getJakartaDateKey } from "../../../shared/lib/dates";
import { getOrders } from "../api";
import OrderCard from "../components/OrderCard";
import OrderDateRangeFilter from "../components/OrderDateRangeFilter";
import OrdersSummary from "../components/OrdersSummary";
import useOrderActions from "../hooks/useOrderActions";
import {
  filterOrdersByDateRange,
  getSummaryDateRangeLabel,
  groupOrdersByDay,
} from "../utils/orderFilters";
import {
  getOrdersGrossRevenueTotal,
  getOrdersNetRevenueTotal,
} from "../utils/orderMetrics";

const OrdersPage = () => {
  const todayKey = getJakartaDateKey();
  const [dateRange, setDateRange] = useState({
    startDate: todayKey,
    endDate: todayKey,
  });
  const orderActions = useOrderActions();

  useEffect(() => {
    document.title = "POS | Orders";
  }, []);

  const { data: resData, isError } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      return await getOrders();
    },
    placeholderData: keepPreviousData,
  });

  if (isError) {
    enqueueSnackbar("Something went wrong!", { variant: "error" });
  }

  const orders = useMemo(() => resData?.data.data || [], [resData]);
  const filteredOrders = useMemo(
    () => filterOrdersByDateRange(orders, dateRange),
    [orders, dateRange]
  );
  const filteredGrossRevenue = useMemo(
    () => getOrdersGrossRevenueTotal(filteredOrders),
    [filteredOrders]
  );
  const filteredNetRevenue = useMemo(
    () => getOrdersNetRevenueTotal(filteredOrders),
    [filteredOrders]
  );
  const groupedOrders = useMemo(() => groupOrdersByDay(filteredOrders), [filteredOrders]);

  return (
    <section className="bg-[#1f1f1f] min-h-[calc(100vh-5rem)] overflow-y-auto pb-16">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4 md:px-10 py-4">
        <div className="flex items-center gap-4">
          <BackButton />
          <h1 className="text-[#f5f5f5] text-2xl font-bold tracking-wider">
            Orders
          </h1>
        </div>
        <OrderDateRangeFilter dateRange={dateRange} onChange={setDateRange} />
      </div>

      <OrdersSummary
        rangeLabel={getSummaryDateRangeLabel(dateRange)}
        grossRevenue={filteredGrossRevenue}
        netRevenue={filteredNetRevenue}
        orderCount={filteredOrders.length}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3 px-4 md:px-10 xl:px-16 py-4">
        {groupedOrders.length > 0 ? (
          groupedOrders.map((group) => (
            <React.Fragment key={group.dateKey}>
              <div className="col-span-full mt-2 flex items-center gap-3 first:mt-0">
                <div className="h-px flex-1 bg-[#3a3a3a]" />
                <p className="shrink-0 rounded-lg border border-[#a79981]/40 px-3 py-1 text-sm font-bold text-[#a79981]">
                  {group.label}
                </p>
                <div className="h-px flex-1 bg-[#3a3a3a]" />
              </div>
              {group.orders.map((order) => {
                const orderId = order.id || order._id;

                return (
                  <OrderCard
                    key={orderId}
                    order={order}
                    onCateringPaymentAdd={(amount) =>
                      orderActions.addCateringPayment(orderId, amount)
                    }
                    isAddingCateringPayment={orderActions.isAddingCateringPayment(orderId)}
                    onOrderDelete={() => orderActions.deleteOrder(orderId)}
                    isDeletingOrder={orderActions.isDeletingOrder(orderId)}
                  />
                );
              })}
            </React.Fragment>
          ))
        ) : (
          <p className="col-span-3 text-gray-500">No orders available</p>
        )}
      </div>

      <BottomNav />
    </section>
  );
};

export default OrdersPage;
