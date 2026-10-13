import { useMutation } from "@tanstack/react-query";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { logout } from "../api";
import { removeUser } from "../userSlice";

// Clears the server cookie, then the local session, and returns to /auth.
const useLogout = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

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

  return () => logoutMutation.mutate();
};

export default useLogout;
