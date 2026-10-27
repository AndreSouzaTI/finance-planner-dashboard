import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative base so the build works both locally and on GitHub Pages
  base: './',
  build: {
    chunkSizeWarningLimit: 1200,
  },
})
