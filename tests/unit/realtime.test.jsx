import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axiosWrapper } from "../../src/shared/api/client";
import { createTestStore } from "../renderWithProviders";

vi.mock("../../src/shared/api/client", () => ({
  axiosWrapper: { get: vi.fn(), post: vi.fn() },
}));

const pushers = [];
vi.mock("pusher-js", () => ({
  default: class FakePusher {
    constructor(key, options) {
      this.key = key;
      this.options = options;
      this.unsubscribe = vi.fn();
      this.disconnect = vi.fn();
      pushers.push(this);
    }

    subscribe(name) {
      this.channel = { name, handlers: {}, bind(event, handler) { this.handlers[event] = handler; } };
      return this.channel;
    }
  },
}));

const socket = { on: vi.fn(), off: vi.fn() };
vi.mock("socket.io-client", () => ({ io: vi.fn(() => socket) }));

const pusherConfig = { provider: "pusher", key: "c7489", cluster: "ap1", channel: "private-pos" };

// The hook keeps its config per page load: a fresh module for every test.
const renderRealtime = async ({ isAuth }) => {
  const { default: useRealtimeData } = await import("../../src/app/realtime/useRealtimeData");
  const queryClient = new QueryClient();
  vi.spyOn(queryClient, "invalidateQueries");
  const Listener = () => {
    useRealtimeData();
    return null;
  };
  const view = render(
    <Provider store={createTestStore({ user: { isAuth, name: "Kasir", role: "Cashier" } })}>
      <QueryClientProvider client={queryClient}>
        <Listener />
      </QueryClientProvider>
    </Provider>
  );
  return { queryClient, ...view };
};

describe("realtime", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    pushers.length = 0;
  });

  it("listens on the backend's private Pusher channel once logged in, and refetches what changed", async () => {
    axiosWrapper.get.mockResolvedValue({ data: { data: pusherConfig } });
    axiosWrapper.post.mockResolvedValue({ data: { auth: "c7489:signature" } });
    const { queryClient, unmount } = await renderRealtime({ isAuth: true });

    await waitFor(() => expect(pushers).toHaveLength(1));
    const [pusher] = pushers;
    expect(axiosWrapper.get).toHaveBeenCalledWith("/api/realtime/config");
    expect([pusher.key, pusher.options.cluster, pusher.channel.name]).toEqual(["c7489", "ap1", "private-pos"]);
    expect(socket.on).not.toHaveBeenCalled();

    // The backend signs the subscription with the user's session.
    const callback = vi.fn();
    pusher.options.channelAuthorization.customHandler({ socketId: "1.2", channelName: "private-pos" }, callback);
    await waitFor(() => expect(callback).toHaveBeenCalledWith(null, { auth: "c7489:signature" }));
    expect(axiosWrapper.post).toHaveBeenCalledWith("/api/realtime/pusher/auth", {
      socket_id: "1.2",
      channel_name: "private-pos",
    });

    pusher.channel.handlers["orders:changed"]();
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["orders"] });
    pusher.channel.handlers["stock:changed"]();
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["semi-items"] });

    unmount();
    expect(pusher.unsubscribe).toHaveBeenCalledWith("private-pos");
    expect(pusher.disconnect).toHaveBeenCalled();
  });

  it("does not open the private channel before login", async () => {
    axiosWrapper.get.mockResolvedValue({ data: { data: pusherConfig } });
    await renderRealtime({ isAuth: false });

    await waitFor(() => expect(axiosWrapper.get).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(pushers).toHaveLength(0);
  });

  it("stays on Socket.IO when the backend has no Pusher", async () => {
    axiosWrapper.get.mockResolvedValue({ data: { data: { provider: "socket.io" } } });
    await renderRealtime({ isAuth: false });

    await waitFor(() => expect(socket.on).toHaveBeenCalledWith("orders:changed", expect.any(Function)));
    expect(pushers).toHaveLength(0);
  });
});
