/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  // Served from https://jacoxnet.github.io/monte-ts/
  base: '/monte-ts/',
  plugins: [svelte()],
  worker: { format: 'es' },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
