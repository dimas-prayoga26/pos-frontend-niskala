import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import {
  formatJakartaDate,
  formatJakartaTime,
} from "../../utils";

const Greetings = () => {
  const userData = useSelector((state) => state.user);
  const [dateTime, setDateTime] = useState(new Date());
  const displayRole = ["admin", "cashier"].includes(
    userData.role?.toLowerCase()
  )
    ? userData.role
    : "Cashier";
  const displayName =
    userData.name?.toLowerCase() === "waiter"
      ? displayRole
      : userData.name || displayRole;

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getGreeting = (date) => {
    const hour = Number(
      formatJakartaTime(date, { second: undefined }).slice(0, 2)
    );

    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 px-4 md:px-8 mt-5">
      <div>
        <h1 className="text-[#f5f5f5] text-xl md:text-2xl font-semibold tracking-wide">
          {getGreeting(dateTime)}, {displayName}
        </h1>
        <p className="text-[#ababab] text-sm">
          Kelola transaksi dan pesanan hari ini.
        </p>
      </div>
      <div className="sm:text-right">
        <h1 className="text-[#f5f5f5] text-2xl md:text-3xl font-bold tracking-wide">
          {formatJakartaTime(dateTime)}
        </h1>
        <p className="text-[#ababab] text-sm">{formatJakartaDate(dateTime)}</p>
      </div>
    </div>
  );
};

export default Greetings;
