import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  root: resolve(import.meta.dirname, "."),
  envDir: resolve(import.meta.dirname, "../.."),
  server: {
    host: process.env.STUDIO_HOST ?? "127.0.0.1",
    port: Number(process.env.STUDIO_CLIENT_PORT ?? 5180),
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.STUDIO_API_ORIGIN ?? "http://127.0.0.1:5179",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@studio/shared": resolve(import.meta.dirname, "..", "shared"),
    },
  },
});
