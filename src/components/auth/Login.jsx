import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query"
import { login } from "../../https/index"
import { enqueueSnackbar } from "notistack";
import { useDispatch } from "react-redux";
import { setUser } from "../../redux/slices/userSlice";
import { useNavigate } from "react-router-dom";
 
const Login = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const[formData, setFormData] = useState({
      email: "",
      password: "",
    });
  
    const handleChange = (e) => {
      setFormData({...formData, [e.target.name]: e.target.value});
    }

  
    const handleSubmit = (e) => {
      e.preventDefault();
      loginMutation.mutate(formData);
    }

    const loginMutation = useMutation({
      mutationFn: (reqData) => login(reqData),
      onSuccess: (res) => {
          const { data } = res;
          console.log(data);
          const { _id, name, email, phone, role } = data.data;
          dispatch(setUser({ _id, name, email, phone, role }));
          navigate("/");
      },
      onError: (error) => {
        const message = error?.response?.data?.message || "Login failed";
        enqueueSnackbar(message, { variant: "error" });
      }
    })

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-4">
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

        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="mt-2 w-full rounded-lg bg-[#a79981] py-3 text-base font-bold text-[#101010] transition hover:bg-[#b8ad97] disabled:cursor-not-allowed disabled:opacity-70 sm:text-lg"
        >
          {loginMutation.isPending ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
};

export default Login;
