import React, { useEffect, useState } from "react";
import restaurant from "../assets/images/restaurant-img.jpg";
import logo from "../../../assets/logo1.png";
import Register from "../components/auth/Register";
import Login from "../components/auth/Login";

const Auth = () => {
  useEffect(() => {
    document.title = "POS | Auth";
  }, []);

  const [isRegister, setIsRegister] = useState(false);

  return (
    <div className="min-h-screen w-full bg-[#101010] lg:grid lg:grid-cols-[0.95fr_1.05fr]">
      <aside className="relative hidden min-h-screen overflow-hidden lg:flex lg:items-end">
        <img
          className="absolute inset-0 h-full w-full object-cover"
          src={restaurant}
          alt="Restaurant"
        />
        <div className="absolute inset-0 bg-black/75"></div>
        <blockquote className="relative z-10 px-10 pb-14 text-2xl italic leading-relaxed text-white xl:px-14">
          "Serve customers the best food with prompt and friendly service in a
          welcoming atmosphere, and they'll keep coming back."
          <span className="mt-5 block text-lg font-semibold text-[#a79981]">
            - Founder of Restro
          </span>
        </blockquote>
      </aside>

      <main className="relative flex min-h-screen items-start justify-center overflow-y-auto px-4 py-8 sm:px-6 sm:py-10 md:px-8 lg:items-center lg:bg-[#1a1a1a] lg:px-10">
        <div className="absolute inset-x-0 top-0 h-44 overflow-hidden lg:hidden">
          <img
            className="h-full w-full object-cover"
            src={restaurant}
            alt="Restaurant"
          />
          <div className="absolute inset-0 bg-black/75"></div>
        </div>

        <div className="relative z-10 w-full max-w-md rounded-lg border border-[#2a2a2a] bg-[#1a1a1a]/95 p-5 shadow-2xl shadow-black/30 sm:p-7 md:max-w-2xl md:p-8 lg:max-w-xl lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          <div className="flex flex-col items-center gap-2">
            <img
              src={logo}
              alt="Restro Logo"
              className="h-24 w-44 object-contain sm:h-28 sm:w-52"
            />
          </div>

          <h2 className="mb-6 mt-7 text-center text-2xl font-semibold text-[#a79981] sm:text-3xl md:mb-8 lg:text-4xl">
            {isRegister ? "Employee Registration" : "Employee Login"}
          </h2>

          {isRegister ? <Register setIsRegister={setIsRegister} /> : <Login />}

          <div className="mt-6 flex justify-center text-center">
            <p className="text-sm text-[#ababab]">
              {isRegister
                ? "Already have an account?"
                : "Don't have an account?"}{" "}
              <button
                type="button"
                onClick={() => setIsRegister(!isRegister)}
                className="font-semibold text-[#a79981] hover:underline"
              >
                {isRegister ? "Sign in" : "Sign up"}
              </button>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Auth;
