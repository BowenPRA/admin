import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves this repo at the custom domain https://current.pra.edu.vn/
// (public/CNAME keeps the domain across deploys). If the site ever goes back to
// https://bowenpra.github.io/admin/, set `base` to '/admin/' and delete public/CNAME.
export default defineConfig(({ command, mode }) => {
  // Without the Supabase settings the app runs in offline mode (data kept in
  // each browser only). On 19 October 2026 a deploy from the new laptop, which
  // had no .env yet, put the live site in offline mode, so a production build
  // without them now stops here instead.
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  if (command === 'build' && mode === 'production' && !(env.VITE_SUPABASE_URL && (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY))) {
    throw new Error('No VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY in .env: this build would put the live site in offline mode. Copy .env.example to .env and fill it in from Supabase > Project Settings > API.')
  }
  return {
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
  }
})
