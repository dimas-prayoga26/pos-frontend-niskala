import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const frontendDir = fileURLToPath(new URL(".", import.meta.url));
  const backendDir = fileURLToPath(new URL("../pos-backend/", import.meta.url));
  const frontendEnv = loadEnv(mode, frontendDir, "");
  const backendEnv = loadEnv(mode, backendDir, "");
  const target = frontendEnv.API_PROXY_TARGET ||
    `http://127.0.0.1:${backendEnv.PORT || 8080}`;
  const proxy = Object.fromEntries(
    ["/api", "/uploads", "/socket.io"].map((route) => [route, {
      target,
      changeOrigin: false,
      xfwd: true,
      ws: route === "/socket.io",
    }])
  );

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      proxy,
    },
    preview: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      proxy,
    },
  };
});
