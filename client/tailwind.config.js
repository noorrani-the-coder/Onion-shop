/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mandi: {
          50: '#f4fbf7',
          100: '#e3f7ec',
          200: '#c5eed9',
          300: '#94e0bc',
          400: '#5ac998',
          500: '#32ae7a',
          600: '#238d61',
          700: '#1d704f',
          800: '#1a5840',
          900: '#164836',
          950: '#0a291f',
        },
        onion: {
          50: '#fdf3f4',
          100: '#fce7e8',
          200: '#f8d1d4',
          300: '#f2aeb4',
          400: '#e87e87',
          500: '#d7525f',
          600: '#c03847',
          700: '#a12b38',
          800: '#862731',
          900: '#72242d',
          950: '#400f14',
        },
        harvest: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'sans-serif']
      }
    },
  },
  plugins: [],
}
