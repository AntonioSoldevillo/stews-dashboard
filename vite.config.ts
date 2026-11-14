import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// "base" must match the GitHub repo name for GitHub Pages
export default defineConfig({
  base: '/stews-dashboard/',
  plugins: [react(), tailwindcss()],
});