/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Deep teal-navy used for primary buttons and text (matches screenshot)
        brand: {
          50:  '#eaf2f6',
          100: '#d0e1e8',
          500: '#1f5a72',
          600: '#154559',
          700: '#0e3a4a',
          800: '#0a2f3c',
          900: '#072431',
        },
        // Warm coral accent (the orange dot in the twinmind logo)
        accent: {
          500: '#f59452',
          600: '#ef7a33',
        },
        // Soft sky/mist palette for surfaces
        mist: {
          50:  '#f5f9fb',
          100: '#e7f1f4',
          200: '#cfe2e8',
          300: '#b0cfd8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 4px 20px -8px rgba(14, 58, 74, 0.15)',
        card: '0 8px 28px -12px rgba(14, 58, 74, 0.22)',
      },
    },
  },
  plugins: [],
};
