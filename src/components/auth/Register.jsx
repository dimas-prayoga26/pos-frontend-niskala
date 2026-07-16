import React, { useState } from "react";
import { register } from "../../https";
import { useMutation } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";

const Register = ({setIsRegister}) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRoleSelection = (selectedRole) => {
    setFormData({ ...formData, role: selectedRole });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.role) {
      enqueueSnackbar("Please choose employee role", { variant: "error" });
      return;
    }

    registerMutation.mutate(formData);
  };

  const registerMutation = useMutation({
    mutationFn: (reqData) => register(reqData),
    onSuccess: (res) => {
      const { data } = res;
      enqueueSnackbar(data.message, { variant: "success" });
      setFormData({
        name: "",
        email: "",
        phone: "",
        password: "",
        role: "",
      });
      
      setTimeout(() => {
        setIsRegister(false);
      }, 1500);
    },
    onError: (error) => {
      const message = error?.response?.data?.message || "Registration failed";
      enqueueSnackbar(message, { variant: "error" });
    },
  });

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-[#ababab]">
            Employee Name
          </label>
          <div className="flex min-h-[52px] items-center rounded-lg bg-[#1f1f1f] px-4 py-3 ring-1 ring-transparent transition focus-within:ring-[#a79981]/50 sm:min-h-[58px]">
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter employee name"
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#6f6f6f] sm:text-base"
              required
            />
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-[#ababab]">
            Employee Email
          </label>
          <div className="flex min-h-[52px] items-center rounded-lg bg-[#1f1f1f] px-4 py-3 ring-1 ring-transparent transition focus-within:ring-[#a79981]/50 sm:min-h-[58px]">
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter employee email"
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#6f6f6f] sm:text-base"
              required
            />
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-[#ababab]">
            Employee Phone
          </label>
          <div className="flex min-h-[52px] items-center rounded-lg bg-[#1f1f1f] px-4 py-3 ring-1 ring-transparent transition focus-within:ring-[#a79981]/50 sm:min-h-[58px]">
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Enter employee phone"
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#6f6f6f] sm:text-base"
              required
            />
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-[#ababab]">
            Password
          </label>
          <div className="flex min-h-[52px] items-center rounded-lg bg-[#1f1f1f] px-4 py-3 ring-1 ring-transparent transition focus-within:ring-[#a79981]/50 sm:min-h-[58px]">
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter password"
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#6f6f6f] sm:text-base"
              required
            />
          </div>
        </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-[#ababab]">
            Choose your role
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {["Waiter", "Cashier", "Admin"].map((role) => {
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleRoleSelection(role)}
                  className={`min-h-[48px] rounded-lg px-4 py-3 text-sm font-semibold transition ${
                    formData.role === role
                      ? "bg-[#a79981] text-[#101010]"
                      : "bg-[#1f1f1f] text-[#ababab] hover:text-[#a79981]"
                  }`}
                >
                  {role}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={registerMutation.isPending}
          className="mt-2 w-full rounded-lg bg-[#a79981] py-3 text-base font-bold text-[#101010] transition hover:bg-[#b8ad97] disabled:cursor-not-allowed disabled:opacity-70 sm:text-lg"
        >
          {registerMutation.isPending ? "Signing up..." : "Sign up"}
        </button>
      </form>
    </div>
  );
};

export default Register;
