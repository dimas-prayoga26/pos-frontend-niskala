import React, { useEffect } from "react";
import BottomNav from "../components/shared/BottomNav";
import Greetings from "../components/home/Greetings";
import { BsCashCoin } from "react-icons/bs";
import { MdOutlineReceiptLong } from "react-icons/md";
import MiniCard from "../components/home/MiniCard";
import RecentOrders from "../components/home/RecentOrders";
import PopularDishes from "../components/home/PopularDishes";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getOrders } from "../https";
import { getJakartaDateKey, getOrderReceivedAmount } from "../utils";

const Home = () => {
  const { data: ordersRes } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
    placeholderData: keepPreviousData,
  });

  const getRelativeDateKey = (offsetDays) => {
    const date = new Date(`${getJakartaDateKey()}T00:00:00+07:00`);
    date.setUTCDate(date.getUTCDate() + offsetDays);

    return getJakartaDateKey(date);
  };
  const getPercentageChange = (currentValue, previousValue) => {
    if (!previousValue) return currentValue > 0 ? 100 : 0;

    return Math.round(((currentValue - previousValue) / previousValue) * 100);
  };

  const orders = ordersRes?.data?.data || [];
  const todayKey = getJakartaDateKey();
  const yesterdayKey = getRelativeDateKey(-1);
  const todayOrders = orders.filter(
    (order) => getJakartaDateKey(order.orderDate) === todayKey
  );
  const yesterdayOrders = orders.filter(
    (order) => getJakartaDateKey(order.orderDate) === yesterdayKey
  );
  const todayRevenue = todayOrders.reduce((total, order) => {
    return total + getOrderReceivedAmount(order);
  }, 0);
  const yesterdayRevenue = yesterdayOrders.reduce((total, order) => {
    return total + getOrderReceivedAmount(order);
  }, 0);
  const revenuePercentageChange = getPercentageChange(
    todayRevenue,
    yesterdayRevenue
  );
  const orderPercentageChange = getPercentageChange(
    todayOrders.length,
    yesterdayOrders.length
  );

    useEffect(() => {
      document.title = "POS | Home"
    }, [])

  return (
    <section className="bg-[#1f1f1f] min-h-[calc(100vh-5rem)] overflow-y-auto pb-16 flex flex-col xl:flex-row gap-3">
      {/* Left Div */}
      <div className="flex-[3] min-w-0">
        <Greetings />
        <div className="grid grid-cols-1 sm:grid-cols-2 w-full gap-3 px-4 md:px-8 mt-8">
          <MiniCard
            title="Total Pendapatan"
            icon={<BsCashCoin />}
            number={todayRevenue}
            percentageChange={revenuePercentageChange}
            isCurrency
          />
          <MiniCard
            title="Order Hari Ini"
            icon={<MdOutlineReceiptLong />}
            number={todayOrders.length}
            percentageChange={orderPercentageChange}
          />
        </div>
        <RecentOrders />
      </div>
      {/* Right Div */}
      <div className="flex-[2] min-w-0 px-4 md:px-0">
        <PopularDishes />
      </div>
      <BottomNav />
    </section>
  );
};

export default Home;
