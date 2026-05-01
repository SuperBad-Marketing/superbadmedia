import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5200,
    watch: {
      ignored: ['**/.media-library/**', '**/.clients/**', '**/.projects/**', '**/.skills/**', '**/.taste/**', '**/.cut-review/**', '**/.grading-frames/**'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5201',
        changeOrigin: true,
      },
      '/thumbnails': {
        target: 'http://localhost:5201',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://localhost:5201',
        changeOrigin: true,
      },
    },
  },
})
