import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        serif: ['Playfair Display', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "#e4572e",
          100: "#311006",
          200: "#61200d",
          300: "#923113",
          400: "#c34119",
          500: "#e4572e",
          600: "#e97b59",
          700: "#ef9c82",
          800: "#f4bdac",
          900: "#faded5",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "#17bebb",
          100: "#052626",
          200: "#094c4b",
          300: "#0e7271",
          400: "#139996",
          500: "#17bebb",
          600: "#2ce5e2",
          700: "#61ebe9",
          800: "#96f2f0",
          900: "#caf8f8",
          foreground: "hsl(var(--secondary-foreground))",
        },
        accent: {
          DEFAULT: "#ffc914",
          100: "#372a00",
          200: "#6e5400",
          300: "#a57f00",
          400: "#dca900",
          500: "#ffc914",
          600: "#ffd343",
          700: "#ffde72",
          800: "#ffe9a1",
          900: "#fff4d0",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config

export default config

