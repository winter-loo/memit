/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    svelte({
      // https://github.com/sveltejs/svelte/issues/5869
      emitCss: false,
    }),
    svelteTesting(),
    crx({ manifest }),
  ],
  build: {
    rollupOptions: {
      input: {
        options: 'options.html',
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup-vitest.ts'],
    globals: true,
  },
});
