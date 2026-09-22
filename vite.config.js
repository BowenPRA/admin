import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves this repo at the custom domain https://current.pra.edu.vn/
// (public/CNAME keeps the domain across deploys). If the site ever goes back to
// https://bowenpra.github.io/admin/, set `base` to '/admin/' and delete public/CNAME.
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // PDF libraries stay out of vendor so they load only when an invoice PDF is made or previewed
          if (id.includes('node_modules/pdfmake')) return 'pdfmake'
          if (id.includes('node_modules/pdfjs-dist')) return undefined // its own lazy chunk
          if (id.includes('node_modules/exceljs')) return 'exceljs' // only loads when a student list is exported
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },
    chunkSizeWarningLimit: 1200,
  },
})
