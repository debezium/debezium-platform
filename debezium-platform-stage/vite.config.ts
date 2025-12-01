import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tsconfigPaths from 'vite-tsconfig-paths';
import { loadEnv } from 'vite';

const env = loadEnv('all', process.cwd());
const API_URL = `${env.VITE_BACKEND_API_URL ?? 'http://localhost:8080'}`;
const PORT = +`${env.VITE_PORT ?? 3000}`;


const config = {
  plugins: [react(), tsconfigPaths()],
  server: {
    proxy: {
      "/api": {
        target: API_URL,
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api/, "/api"), // Keep '/api' prefix
      },
    },
    port: PORT,
  },
  preview: {
    port: PORT,
  },
  test: {
    // 👋 add the line below to add jsdom to vite
    include: ['src/**/*.test.{js,jsx,ts,tsx}'], 
    exclude: ['node_modules', 'dist', 'build', 'src/stories/**'],
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts", "./src/__test__/unit/setup.ts"],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    environmentOptions: {
      jsdom: {
        resources: 'usable',
      },
    },
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules', 
        'dist', 
        'build',
        'src/stories/**',
        'src/__mocks__/**',
        'src/__test__/**',
        '**/*.json',
        '**/vitest.setup.ts',
        '**/setup.ts',
      ],
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      all: true,
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
};

// https://vitejs.dev/config/
export default defineConfig(config);
