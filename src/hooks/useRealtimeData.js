import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";

const socketUrl = import.meta.env.VITE_BACKEND_URL;

const useRealtimeData = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socketUrl) return undefined;

    const socket = io(socketUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    const refreshOrders = () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    };

    const refreshMenuData = () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
      queryClient.invalidateQueries({ queryKey: ["add-ons"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    };
    const refreshStockData = () => {
      queryClient.invalidateQueries({ queryKey: ["stock-items"] });
    };
    const refreshPlatformData = () => {
      queryClient.invalidateQueries({ queryKey: ["order-platforms"] });
    };
    const refreshRecapData = () => {
      queryClient.invalidateQueries({ queryKey: ["recaps"] });
      queryClient.invalidateQueries({ queryKey: ["recap-meta"] });
    };

    socket.on("orders:changed", refreshOrders);
    socket.on("menu:changed", refreshMenuData);
    socket.on("stock:changed", refreshStockData);
    socket.on("platforms:changed", refreshPlatformData);
    socket.on("recaps:changed", refreshRecapData);

    return () => {
      socket.off("orders:changed", refreshOrders);
      socket.off("menu:changed", refreshMenuData);
      socket.off("stock:changed", refreshStockData);
      socket.off("platforms:changed", refreshPlatformData);
      socket.off("recaps:changed", refreshRecapData);
      socket.disconnect();
    };
  }, [queryClient]);
};

export default useRealtimeData;
