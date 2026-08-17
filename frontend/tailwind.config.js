/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        iosBlue: '#007AFF',
        iosGreen: '#34C759',
        iosRed: '#FF3B30',
        iosGray: {
          100: '#F5F5F5',
          200: '#E5E5E5',
          300: '#CCCCCC',
          500: '#888888',
          800: '#111111'
        }
      }
    },
  },
  plugins: [],
}
