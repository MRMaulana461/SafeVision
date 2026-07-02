import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Untuk GitHub Pages, base path harus '/nama-repo/' (bukan '/').
// Di-set otomatis oleh workflow GitHub Actions lewat env VITE_BASE_PATH.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  server: {
    port: 5173,
  },
})
