import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During development (`npm run dev`) API calls are forwarded to the backend on :8000.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": "http://localhost:8000" },
  },
});
