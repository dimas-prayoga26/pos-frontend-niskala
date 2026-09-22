import React, { useEffect } from "react";
import restaurant from "../../../assets/Feed Nisakala - P2.png";
import logo from "../../../assets/logo1.png";
import Login from "../components/auth/Login";

const Auth = () => {
  useEffect(() => {
    document.title = "POS | Auth";
  }, []);

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-[#101010] xl:grid xl:grid-cols-[0.95fr_1.05fr]">
      <div className="absolute inset-0 xl:hidden">
        <img
          className="h-full w-full object-cover"
          src={restaurant}
          alt="Restaurant"
        />
        <div className="absolute inset-0 bg-black/40"></div>
      </div>

      <aside className="relative hidden min-h-[100dvh] overflow-hidden xl:flex xl:items-end">
        <img
          className="absolute inset-0 h-full w-full object-cover"
          src={restaurant}
          alt="Restaurant"
        />
        <div className="absolute inset-0 bg-black/40"></div>
        <blockquote className="relative z-10 px-10 pb-14 text-2xl italic leading-relaxed text-white xl:px-14">
          "Serve customers the best food with prompt and friendly service in a
          welcoming atmosphere, and they'll keep coming back."
          <span className="mt-5 block text-lg font-semibold text-[#a79981]">
            - Founder of Restro
          </span>
        </blockquote>
      </aside>

      <main className="relative z-10 flex min-h-[100dvh] items-center justify-center overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 md:px-8 xl:bg-[#1a1a1a] xl:px-10">
        <div className="w-full max-w-md rounded-lg border border-[#2a2a2a] bg-[#1a1a1a]/95 p-5 shadow-2xl shadow-black/40 backdrop-blur-sm sm:p-7 md:max-w-lg md:p-8 xl:max-w-xl xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none xl:backdrop-blur-0">
          <div className="flex flex-col items-center gap-2">
            <img
              src={logo}
              alt="Restro Logo"
              className="h-20 w-40 object-contain sm:h-24 sm:w-48 md:h-28 md:w-52"
            />
          </div>

          <h2 className="mb-5 mt-6 text-center text-2xl font-semibold text-[#a79981] sm:text-3xl md:mb-7 xl:text-4xl">
            Employee Login
          </h2>

          <Login />
        </div>
      </main>
    </div>
  );
};

export default Auth;
