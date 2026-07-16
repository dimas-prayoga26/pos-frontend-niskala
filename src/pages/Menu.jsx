import React, { useEffect } from "react";
import BottomNav from "../components/shared/BottomNav";
import BackButton from "../components/shared/BackButton";
import MenuContainer from "../components/menu/MenuContainer";
import CustomerInfo from "../components/menu/CustomerInfo";
import CartInfo from "../components/menu/CartInfo";
import Bill from "../components/menu/Bill";

const Menu = () => {

    useEffect(() => {
      document.title = "POS | Menu"
    }, [])

  return (
    <section className="bg-[#1f1f1f] min-h-[calc(100vh-5rem)] pb-28 sm:pb-24 flex flex-col xl:flex-row gap-3">
      {/* Left Div */}
      <div className="flex-[3] min-w-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4 md:px-10 py-4">
          <div className="flex items-center gap-4">
            <BackButton />
            <h1 className="text-[#f5f5f5] text-2xl font-bold tracking-wider">
              Menu
            </h1>
          </div>
          <p className="text-sm text-[#ababab]">Select menu items and fill customer details.</p>
        </div>

        <MenuContainer />
      </div>
      {/* Right Div */}
      <div className="flex-[1] bg-[#1a1a1a] mx-4 xl:mx-0 xl:mt-4 xl:mr-3 rounded-lg pt-2 overflow-hidden">
        {/* Customer Info */}
        <CustomerInfo />
        <hr className="border-[#2a2a2a] border-t-2" />
        {/* Cart Items */}
        <CartInfo />
        <hr className="border-[#2a2a2a] border-t-2" />
        {/* Bills */}
        <Bill />
      </div>

      <BottomNav />
    </section>
  );
};

export default Menu;
