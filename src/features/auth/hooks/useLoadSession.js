import { useDispatch } from "react-redux";
import { getUserData } from "../api";
import { useEffect, useState } from "react";
import { removeUser, setUser } from "../userSlice";
import { useLocation, useNavigate } from "react-router-dom";

// Restores the session from the auth cookie on every navigation; redirects to
// /auth when the cookie is missing or expired. Returns true while loading.
const useLoadSession = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await getUserData();
        const { _id, name, email, phone, role } = data.data;
        dispatch(setUser({ _id, name, email, phone, role }));
      } catch (error) {
        dispatch(removeUser());
        if (location.pathname !== "/auth") {
          navigate("/auth");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
    return undefined;
  }, [dispatch, location.pathname, navigate]);

  return isLoading;
};

export default useLoadSession;
