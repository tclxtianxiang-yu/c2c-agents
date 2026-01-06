import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#13a4ec',
        'primary-hover': '#0e8bc9',
        'background-light': '#f6f7f8',
        'background-dark': '#111618',
        'card-dark': '#1c2327',
        'border-dark': '#283339',
        'text-secondary': '#9db0b9',
      },
      fontFamily: {
        display: ['Public Sans', 'Noto Sans', 'sans-serif'],
        body: ['Public Sans', 'Noto Sans', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        full: '9999px',
      },
      boxShadow: {
        glow: '0 0 15px rgba(19,164,236,0.3)',
        'glow-hover': '0 0 25px rgba(19,164,236,0.5)',
      },
    },
  },
  plugins: [],
};

export default config;
