import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  optimizeDeps: {
    exclude: ['pdfjs-dist']
  },
  worker: {
    format: 'es'
  },
  server: {
    proxy: {
      // Прокси для TensorFlow Hub (обход CORS)
      '/tfhub': {
        target: 'https://tfhub.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tfhub/, ''),
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      },
      // Прокси для GraphQL API (бэкенд на Go)
      '/graphql': {
        target: process.env.VITE_API_URL || 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      },
      // Прокси для GraphQL API на endpoint /query
      '/query': {
        target: process.env.VITE_API_URL || 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      }
    }
  }
})
