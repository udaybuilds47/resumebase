/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        'pressura': ['GT Pressura Extended', 'sans-serif'],
        'spectra': ['GT Spectra Book', 'serif'],
      },
      colors: {
        border: "#e5e7eb",
        input: "#e5e7eb",
        ring: "#000000",
        background: "#ffffff",
        foreground: "#000000",
        primary: {
          DEFAULT: "#000000",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#f3f4f6",
          foreground: "#000000",
        },
        destructive: {
          DEFAULT: "#ef4444",
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "#f3f4f6",
          foreground: "#6b7280",
        },
        accent: {
          DEFAULT: "#f3f4f6",
          foreground: "#000000",
        },
        popover: {
          DEFAULT: "#ffffff",
          foreground: "#000000",
        },
        card: {
          DEFAULT: "#ffffff",
          foreground: "#000000",
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
