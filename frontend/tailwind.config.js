/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        critical: "#b91c1c",
        high: "#c2410c",
        medium: "#a16207",
        low: "#15803d",
      },
    },
  },
  plugins: [],
};
