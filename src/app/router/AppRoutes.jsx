import { useSelector } from "react-redux";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthPage, useLoadSession } from "../../features/auth";
import { DashboardPage } from "../../features/dashboard";
import { HomePage } from "../../features/home";
import { OrdersPage } from "../../features/orders";
import { MenuPage } from "../../features/pos";
import FullScreenLoader from "../../shared/ui/FullScreenLoader";
import Header from "../layouts/Header";

const HIDE_HEADER_ROUTES = ["/auth"];

const ProtectedRoute = ({ children }) => {
  const { isAuth } = useSelector((state) => state.user);

  if (!isAuth) {
    return <Navigate to="/auth" />;
  }

  return children;
};

const protect = (page) => <ProtectedRoute>{page}</ProtectedRoute>;

const AppRoutes = () => {
  const isLoading = useLoadSession();
  const location = useLocation();
  const { isAuth } = useSelector((state) => state.user);

  if (isLoading) return <FullScreenLoader />;

  return (
    <>
      {!HIDE_HEADER_ROUTES.includes(location.pathname) && <Header />}
      <Routes>
        <Route path="/" element={protect(<HomePage />)} />
        <Route path="/auth" element={isAuth ? <Navigate to="/" /> : <AuthPage />} />
        <Route path="/orders" element={protect(<OrdersPage />)} />
        <Route path="/menu" element={protect(<MenuPage />)} />
        <Route path="/dashboard" element={protect(<DashboardPage />)} />
        <Route path="*" element={<div>Not Found</div>} />
      </Routes>
    </>
  );
};

export default AppRoutes;
