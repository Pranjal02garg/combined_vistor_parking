import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Single accent used across both interfaces. Kept dark for outdoor contrast.
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          500: "#2563eb",
          600: "#1d4ed8",
          700: "#1e40af",
        },
      },
      // Respect the iOS safe-area so fixed guard action bars clear the home indicator.
      spacing: {
        "safe-b": "env(safe-area-inset-bottom)",
      },
    },
  },
  plugins: [],
};

export default config;
