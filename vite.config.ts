import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  // VITE_ prefixed env variables are automatically exposed to client code
  // via import.meta.env (e.g., import.meta.env.VITE_SUPABASE_URL)
  // 
  // Required environment variables:
  //   VITE_SUPABASE_URL - Your Supabase project URL
  //   VITE_SUPABASE_ANON_KEY - Your Supabase anon/public key
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  server: {
    proxy: {
      '/.netlify': {
        target: 'http://localhost:8888',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
