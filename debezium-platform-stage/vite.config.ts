import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import tsconfigPaths from 'vite-tsconfig-paths';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, "src");

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const API_URL = env.CONDUCTOR_URL || 'http://localhost:8080';
  const PORT = parseInt(env.VITE_PORT || '3000');

  if (mode === 'development') {
    console.log('\n Vite Configuration:');
    console.log(`   Mode: ${mode}`);
    console.log(`   Conductor URL (Backend): ${API_URL}`);
    console.log(`   Dev Server Port: ${PORT}`);
    console.log(`   Proxy: /api -> ${API_URL}\n`);
  }

  return {
    plugins: [react(), tsconfigPaths()],
    resolve: {
      dedupe: ["react", "react-dom"],
      alias: [
        {
          // Replaces deprecated tsconfig baseUrl for runtime resolution in Vite.
          find: /^src\//,
          replacement: `${srcDir}/`,
        },
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react-query",
        "react-router-dom",
      ],
    },
    define: {
      'import.meta.env.CONDUCTOR_URL': JSON.stringify(API_URL),
    },
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
        reporter: ['text', 'json', 'html', 'lcov'],
        reportsDirectory: './coverage',
        exclude: [
          'node_modules', 
          'dist', 
          'build',
          'src/stories/**',
          '**/*.stories.tsx',
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
});
