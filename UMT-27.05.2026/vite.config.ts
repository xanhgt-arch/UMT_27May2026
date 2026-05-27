import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const backendUrl = env.VITE_BACKEND_URL?.replace(/\/$/, "")

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: backendUrl
      ? {
          proxy: {
            "/api": {
              target: backendUrl,
              changeOrigin: true,
            },
          },
        }
      : undefined,
  }
})
