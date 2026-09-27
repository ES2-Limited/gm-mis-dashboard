import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // same-origin path → NestJS backend (nginx does this in production)
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true,
      },
      // same-origin Insights engine path → DeepSeek (nginx does this in production)
      '/intel': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/intel/, ''),
        // dev parity with production: attach the managed key when the
        // client doesn't send its own (key stays out of the bundle)
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (!req.headers.authorization) {
              proxyReq.setHeader('Authorization', 'Bearer sk-0d838152d4d44d409e93f15bd71b2bdc')
            }
          })
        },
      },
    },
  },
})
