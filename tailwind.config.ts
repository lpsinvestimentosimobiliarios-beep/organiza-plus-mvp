import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0A1835",
        ocean: "#12335F",
        aqua: "#21B7A6",
        leaf: "#25B276",
        amber: "#F59E5B",
        mist: "#EDF5F8",
        cloud: "#F7FAFC",
        danger: "#E05A5A"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(10, 24, 53, 0.14)",
        glow: "0 0 34px rgba(33, 183, 166, 0.22)"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
