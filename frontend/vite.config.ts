import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { "/api": "https://abigailwagura1--floatwise-web.us-east.modal.run" },
  },
  test: { environment: "jsdom", setupFiles: "./src/test/setup.ts" },
});