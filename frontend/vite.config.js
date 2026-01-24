import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    host: "0.0.0.0",
    allowedHosts: ["inveritax.codinghaze.com"],
    proxy: {
      "/api": {
        target: "http://localhost:4001",
        changeOrigin: true
      }
    }
  }
})
