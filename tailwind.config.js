/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Palm River Academy brand colours, taken from the logo.
        pra: {
          green: '#6f9f2f',
          lime: '#8dc63f',
          blue: '#1a7bc4',
          sky: '#2196e3',
          navy: '#1f5aa6',
          ink: '#1f2937',
        },
      },
    },
  },
  plugins: [],
}
