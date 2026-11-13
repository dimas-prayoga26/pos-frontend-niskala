import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { io } from "socket.io-client";
import { backendBaseUrl } from "../../shared/api/backendUrl";
import { axiosWrapper } from "../../shared/api/client";

const socketUrl = backendBaseUrl;
const realtimeTransports = (
  import.meta.env.VITE_REALTIME_TRANSPORTS || "polling"
)
  .split(",")
  .map((transport) => transport.trim())
  .filter(Boolean);

let realtimeSocket;

const getRealtimeSocket = () => {
  if (!socketUrl) return null;

  if (!realtimeSocket) {
    realtimeSocket = io(socketUrl, {
      withCredentials: true,
      transports: realtimeTransports,
    });
  }

  return realtimeSocket;
};

// How to listen, from the backend (GET /api/realtime/config): Pusher Channels
// when it has Pusher keys, else its own Socket.IO.
let realtimeConfigPromise;
const getRealtimeConfig = () => {
  realtimeConfigPromise ??= axiosWrapper
    .get("/api/realtime/config")
    .then((response) => response.data?.data || { provider: "socket.io" })
    .catch(() => {
      realtimeConfigPromise = null;
      return { provider: "socket.io" };
    });

  return realtimeConfigPromise;
};

// Pusher's private channel: the backend signs the subscription of a logged-in
// user (the accessToken cookie goes with the request).
const connectPusher = async ({ key, cluster, channel: channelName }, handlers) => {
  const { default: Pusher } = await import("pusher-js");
  const pusher = new Pusher(key, {
    cluster,
    forceTLS: true,
    channelAuthorization: {
      customHandler: ({ socketId, channelName: requested }, callback) => {
        axiosWrapper
          .post("/api/realtime/pusher/auth", { socket_id: socketId, channel_name: requested })
          .then((response) => callback(null, response.data))
          .catch((error) => callback(error, null));
      },
    },
  });
  const channel = pusher.subscribe(channelName);
  Object.entries(handlers).forEach(([event, handler]) => channel.bind(event, handler));

  return () => {
    pusher.unsubscribe(channelName);
    pusher.disconnect();
  };
};

const connectSocket = (handlers) => {
  const socket = getRealtimeSocket();
  if (!socket) return () => {};

  Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler));
  return () => Object.entries(handlers).forEach(([event, handler]) => socket.off(event, handler));
};

// Backend events -> React Query invalidations, so every tablet refetches the
// affected data. Query keys here must match the features' keys.
const buildHandlers = (queryClient) => {
  const invalidate = (...keys) => () =>
    keys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));

  return {
    "orders:changed": invalidate("orders"),
    "menu:changed": invalidate("categories", "menu-items", "orders"),
    "stock:changed": invalidate("stock-items", "semi-items", "stock-wastes", "supply-items", "purchase-summary"),
    // Purchases also move the saldo of their payment source.
    "shopping:changed": invalidate(
      "purchases",
      "supply-purchases",
      "purchase-drafts",
      "purchase-summary",
      "shopping-suppliers",
      "shopping-merks",
      "payment-sources",
      "payment-source-mutations"
    ),
    "platforms:changed": invalidate("order-platforms"),
    "recaps:changed": invalidate("recaps", "recap-meta"),
  };
};

const useRealtimeData = () => {
  const queryClient = useQueryClient();
  // Pusher's channel is private: listen once someone is logged in.
  const isAuth = useSelector((state) => Boolean(state.user?.isAuth));

  useEffect(() => {
    const handlers = buildHandlers(queryClient);
    let cleanup = () => {};
    let cancelled = false;

    getRealtimeConfig()
      .then(async (config) => {
        if (cancelled) return;

        if (config.provider !== "pusher") {
          cleanup = connectSocket(handlers);
          return;
        }
        if (!isAuth) return;

        const disconnect = await connectPusher(config, handlers);
        if (cancelled) disconnect();
        else cleanup = disconnect;
      })
      .catch((error) => {
        // The data still refreshes on its own every few seconds.
        console.warn("Realtime tidak tersambung:", error?.message || error);
      });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [queryClient, isAuth]);
};

export default useRealtimeData;
