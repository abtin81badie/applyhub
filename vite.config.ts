/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';
import { spaFallback404 } from './vite-plugins/spa-fallback';

/** Normalizes "", "/", "applyhub", "/applyhub" and "/applyhub/" to "/" or "/applyhub/". */
function normalizeBase(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}/` : '/';
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: normalizeBase(env.VITE_BASE_PATH),
    plugins: [react(), tailwindcss(), spaFallback404()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 900,
    },
    server: {
      port: 5173,
      strictPort: false,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}', 'vite-plugins/**/*.test.ts'],
      css: false,
    },
  };
});
