import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
    proxy: {
      "/api/qwen": {
        target: "https://maas.qwencloudapi.com/compatible-mode/v1",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/qwen/, ""),
      },
    },
  },
});
