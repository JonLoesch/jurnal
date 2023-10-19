import { type Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  important: '#app',
  theme: {
    extend: {},
  },
  plugins: [require('daisyui')],
} satisfies Config;
