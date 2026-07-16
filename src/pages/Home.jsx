import React, { useEffect } from "react";
import BottomNav from "../components/shared/BottomNav";
import Greetings from "../components/home/Greetings";
import { BsCashCoin } from "react-icons/bs";
import { GrInProgress } from "react-icons/gr";
import MiniCard from "../components/home/MiniCard";
import RecentOrders from "../components/home/RecentOrders";
import PopularDishes from "../components/home/PopularDishes";

const Home = () => {

    useEffect(() => {
      document.title = "POS | Home"
    }, [])

  return (
    <section className="bg-[#1f1f1f] min-h-[calc(100vh-5rem)] overflow-y-auto pb-16 flex flex-col xl:flex-row gap-3">
      {/* Left Div */}
      <div className="flex-[3] min-w-0">
        <Greetings />
        <div className="grid grid-cols-1 sm:grid-cols-2 w-full gap-3 px-4 md:px-8 mt-8">
          <MiniCard title="Total Earnings" icon={<BsCashCoin />} number={512} footerNum={1.6} />
          <MiniCard title="In Progress" icon={<GrInProgress />} number={16} footerNum={3.6} />
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
