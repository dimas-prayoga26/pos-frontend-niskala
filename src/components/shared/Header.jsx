import React from "react";
import { FaSearch } from "react-icons/fa";
import { FaUserCircle } from "react-icons/fa";
import { FaBell } from "react-icons/fa";
import logo from "../../../../assets/logo2.png";
import { useDispatch, useSelector } from "react-redux";
import { IoLogOut } from "react-icons/io5";
import { useMutation } from "@tanstack/react-query";
import { logout } from "../../https";
import { removeUser } from "../../redux/slices/userSlice";
import { useNavigate } from "react-router-dom";
import { MdDashboard } from "react-icons/md";

const Header = () => {
  const userData = useSelector((state) => state.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const canOpenDashboard = ["admin", "cashier"].includes(
    userData.role?.toLowerCase()
  );

  const logoutMutation = useMutation({
    mutationFn: () => logout(),
    onSuccess: (data) => {
      console.log(data);
      dispatch(removeUser());
      navigate("/auth");
    },
    onError: (error) => {
      console.log(error);
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <header className="flex flex-wrap justify-between items-center gap-3 py-3 px-4 md:px-8 bg-[#1a1a1a]">
      {/* LOGO */}
      <div onClick={() => navigate("/")} className="flex items-center gap-2 cursor-pointer shrink-0">
        <img
          src={logo}
          className="h-9 w-32 object-contain md:h-10 md:w-40"
          alt="Niskala Coffee logo"
        />
      </div>

      {/* SEARCH */}
      <div className="order-3 md:order-none flex items-center gap-3 bg-[#1f1f1f] rounded-[15px] px-4 py-2 w-full md:w-[420px] lg:w-[500px]">
        <FaSearch className="text-[#f5f5f5]" />
        <input
          type="text"
          placeholder="Search"
          className="bg-[#1f1f1f] outline-none text-[#f5f5f5] w-full"
        />
      </div>

      {/* LOGGED USER DETAILS */}
      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        {canOpenDashboard && (
          <div onClick={() => navigate("/dashboard")} className="bg-[#1f1f1f] rounded-[15px] p-2 md:p-3 cursor-pointer">
            <MdDashboard className="text-[#f5f5f5] text-xl md:text-2xl" />
          </div>
        )}
        <div className="bg-[#1f1f1f] rounded-[15px] p-2 md:p-3 cursor-pointer">
          <FaBell className="text-[#f5f5f5] text-xl md:text-2xl" />
        </div>
        <div className="flex items-center gap-2 md:gap-3 cursor-pointer">
          <FaUserCircle className="text-[#f5f5f5] text-3xl md:text-4xl" />
          <div className="hidden sm:flex flex-col items-start">
            <h1 className="text-md text-[#f5f5f5] font-semibold tracking-wide">
              {userData.name || "TEST USER"}
            </h1>
            <p className="text-xs text-[#ababab] font-medium">
              {userData.role || "Role"}
            </p>
          </div>
          <IoLogOut
            onClick={handleLogout}
            className="text-[#f5f5f5] ml-2"
            size={32}
          />
        </div>
      </div>
    </header>
  );
};

export default Header;
