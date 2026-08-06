import { useDispatch } from "react-redux";
import { getUserData } from "../https";
import { useEffect, useState } from "react";
import { removeUser, setUser } from "../redux/slices/userSlice";
import { useLocation, useNavigate } from "react-router-dom";

const useLoadData = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (location.pathname === "/auth") {
      setIsLoading(false);
      return undefined;
    }

    const fetchUser = async () => {
      try {
        const { data } = await getUserData();
        const { _id, name, email, phone, role } = data.data;
        dispatch(setUser({ _id, name, email, phone, role }));
      } catch (error) {
        dispatch(removeUser());
        navigate("/auth");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
    return undefined;
  }, [dispatch, location.pathname, navigate]);

  return isLoading;
};

export default useLoadData;
