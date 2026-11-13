import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import BottomNav from "../../../shared/ui/BottomNav";
import BackButton from "../../../shared/ui/BackButton";
import MenuContainer from "../components/MenuContainer";
import CustomerInfo from "../../../components/menu/CustomerInfo";
import CartInfo from "../components/CartInfo";
import Bill from "../../../components/menu/Bill";
import { setCustomer } from "../../../redux/slices/customerSlice";
import { CREW_MEAL_START_HOUR, CREW_ORDER_TYPE, isCrewMealTime } from "../../../utils";

const CREW_OPENS_AT = `${String(CREW_MEAL_START_HOUR).padStart(2, "0")}:00`;

// Whether Konsumsi Crew is open, checked every 30 seconds so the button turns
// on at 12:00 without a reload.
const useCrewMealTime = () => {
  const [isOpen, setIsOpen] = useState(() => isCrewMealTime());

  useEffect(() => {
    const timer = setInterval(() => setIsOpen(isCrewMealTime()), 30000);
    return () => clearInterval(timer);
  }, []);

  return isOpen;
};

const Menu = () => {
  const dispatch = useDispatch();
  const orderType = useSelector((state) => state.customer.orderType || "Offline");
  const isCrewOpen = useCrewMealTime();

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
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sm text-[#ababab]">Order Type</p>
            <div className="flex rounded-lg bg-[#1a1a1a] p-1">
              <button
                onClick={() =>
                  dispatch(setCustomer({
                    orderType: "Offline",
                    orderPlatformId: null,
                    orderPlatform: "",
                    platformTax: 0,
                  }))
                }
                className={`px-4 py-2 text-sm font-semibold rounded-md ${
                  orderType === "Offline"
                    ? "bg-[#a79981] text-[#101010]"
                    : "text-[#ababab]"
                }`}
              >
                Offline
              </button>
              <button
                onClick={() => dispatch(setCustomer({ orderType: "Online" }))}
                className={`px-4 py-2 text-sm font-semibold rounded-md ${
                  orderType === "Online"
                    ? "bg-[#a79981] text-[#101010]"
                    : "text-[#ababab]"
                }`}
              >
                Online
              </button>
              {/* Konsumsi Crew: a crew member's free meal, from 12:00. */}
              <button
                onClick={() =>
                  dispatch(setCustomer({
                    orderType: CREW_ORDER_TYPE,
                    orderPlatformId: null,
                    orderPlatform: "",
                    platformTax: 0,
                  }))
                }
                disabled={!isCrewOpen}
                title={isCrewOpen ? "Konsumsi crew: menu gratis" : `Mulai jam ${CREW_OPENS_AT}`}
                className={`px-4 py-2 text-sm font-semibold rounded-md disabled:cursor-not-allowed disabled:opacity-40 ${
                  orderType === CREW_ORDER_TYPE
                    ? "bg-[#a79981] text-[#101010]"
                    : "text-[#ababab]"
                }`}
              >
                Crew
              </button>
            </div>
          </div>
        </div>

        <MenuContainer />
      </div>
      {/* Right Div */}
      <div className="bg-[#1a1a1a] mx-4 xl:mx-0 xl:mt-4 xl:mr-3 rounded-lg pt-2 overflow-hidden xl:sticky xl:top-4 xl:self-start xl:max-h-[calc(100vh-7rem)] xl:w-[470px] xl:flex-none xl:overflow-y-auto xl:scrollbar-hide">
        {/* Customer Info */}
        <CustomerInfo />
        <hr className="shrink-0 border-[#2a2a2a] border-t-2" />
        {/* Cart Items */}
        <CartInfo />
        <hr className="shrink-0 border-[#2a2a2a] border-t-2" />
        {/* Bills */}
        <Bill />
      </div>

      <BottomNav />
    </section>
  );
};

export default Menu;
