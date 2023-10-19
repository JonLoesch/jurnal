import { type Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  important: "#app",
  theme: {
    extend: {},
  },
  plugins: [
    require("daisyui"),
    require("@headlessui/tailwindcss"),
    plugin(({ addVariant }) => {
      addVariant("link-active", ".link-active &");
    }),
  ],
} satisfies Config;
