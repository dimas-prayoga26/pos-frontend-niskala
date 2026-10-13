import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Separate from vite.config.js so the dev proxy and build stay untouched.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.js"],
    include: ["src/**/*.test.{js,jsx}", "tests/**/*.test.{js,jsx}"],
    restoreMocks: true,
  },
});
