import { defineConfig } from "vite";
import type { InlineConfig } from "vitest";
import type { UserConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tsconfigPaths from 'vite-tsconfig-paths';
import { loadEnv } from 'vite';

const env = loadEnv('all', process.cwd());
const API_URL = `${env.VITE_BACKEND_API_URL ?? 'http://localhost:8080'}`;
const PORT = +`${env.VITE_PORT ?? 3000}`;

type ViteConfig = UserConfig & { test: InlineConfig };
const config: ViteConfig = {
  plugins: [react(), tsconfigPaths()],
  server: {
    proxy: {
      "/api": {
        target: API_URL,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "/api"), // Keep '/api' prefix
      },
    },
    port: PORT,
  },
  test: {
    // 👋 add the line below to add jsdom to vite
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/__test__/unit/setup.ts",
  },
};

// https://vitejs.dev/config/
export default defineConfig(config);
