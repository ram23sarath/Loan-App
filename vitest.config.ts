import path from 'path';
import { defineConfig, defineProject } from 'vitest/config';

const frontendProject = defineProject({
  test: {
    name: 'frontend',
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});

const backendProject = defineProject({
  test: {
    name: 'netlify-functions',
    globals: true,
    environment: 'node',
    include: ['netlify/functions/**/*.test.{ts,tsx}'],
  },
});

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    projects: [frontendProject, backendProject],
  },
});
