import React from "react";
import { FaHome } from "react-icons/fa";
import { MdOutlineReorder } from "react-icons/md";
import { BiSolidDish } from "react-icons/bi";
import { useLocation, useNavigate } from "react-router-dom";

const navButtonClass = (isActive) =>
  `group relative z-10 flex h-10 flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl font-bold transition-all duration-200 ${
    isActive
      ? "bg-[#383838] text-[#f5f5f5] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_22px_rgba(0,0,0,0.22)]"
      : "text-[#9c9c9c] hover:bg-[#303030] hover:text-[#f5f5f5]"
  }`;

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex h-[68px] justify-center bg-[#1f1f1f] px-3">
      <div className="relative h-[68px] w-full max-w-[720px]">
        <div
          className="absolute bottom-0 h-[54px] w-full rounded-t-[27px] rounded-b-none bg-[#262626] shadow-[0_14px_34px_rgba(0,0,0,0.42)]"
          style={{
            WebkitMaskImage:
              "radial-gradient(circle 46px at 50% -10px, transparent 45px, #000 46px)",
            maskImage:
              "radial-gradient(circle 46px at 50% -10px, transparent 45px, #000 46px)",
          }}
        />

        <div className="absolute bottom-[8px] grid h-10 w-full grid-cols-[1fr_86px_1fr] items-center gap-2 px-3">
          <button
            onClick={() => navigate("/")}
            className={navButtonClass(isActive("/"))}
          >
            {isActive("/") && (
              <span className="absolute bottom-1 h-1 w-8 rounded-full bg-[#A79981]" />
            )}
            <FaHome className="relative" size={20} />
            <span className="relative hidden sm:inline">Home</span>
          </button>

          <div />

          <button
            onClick={() => navigate("/orders")}
            className={navButtonClass(isActive("/orders"))}
          >
            {isActive("/orders") && (
              <span className="absolute bottom-1 h-1 w-8 rounded-full bg-[#A79981]" />
            )}
            <MdOutlineReorder className="relative" size={22} />
            <span className="relative hidden sm:inline">Orders</span>
          </button>
        </div>

        <button
          disabled={isActive("/menu")}
          onClick={() => navigate("/menu")}
          className={`absolute bottom-[35px] left-1/2 z-20 flex h-[52px] w-[52px] -translate-x-1/2 items-center justify-center rounded-full bg-[#A79981] text-[#101010] shadow-[0_14px_28px_rgba(167,153,129,0.24),0_8px_26px_rgba(0,0,0,0.42)] ring-[8px] transition-transform duration-200 hover:-translate-x-1/2 hover:-translate-y-1 disabled:opacity-90 ${
            isActive("/menu")
              ? "ring-[#2b2923] outline outline-2 outline-[#A79981]/50"
              : "ring-[#1f1f1f]"
          }`}
        >
          <BiSolidDish size={28} />
        </button>
      </div>
    </div>
  );
};

export default BottomNav;
