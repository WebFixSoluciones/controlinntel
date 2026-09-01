/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        inntel: {
          blue: "#0066B3",
          purple: "#7A4499",
          dark: "#0F172A",
          cyan: "#00AEEF",
        },
      },
    },
  },
  plugins: [],
};
