import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages の配信パス。リポジトリ名と一致させること。
// ここがずれると Pages 上でアセットが 404 になる。
export default defineConfig({
  plugins: [react()],
  base: '/receipt-to-sheet/',
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})
