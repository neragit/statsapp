// tailwind.config.js

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,html}",
  ],
  theme: {
    extend: {
      colors: {
        // Core palette
        primary: "var(--primary)",
        primaryOpaque: "var(--primary-opaque)",
        primaryDim: "var(--primary-dim)",
        primaryDim2: "var(--primary-dim-2)",
        primaryDim3: "var(--primary-dim-3)",

        // Warning / secondary
        sampleBeige: "var(--sample-beige)",
        beigeOpaque: "var(--warning-opaque)",
        samplePurple: "var(--sample-purple)",

        // Error
        danger: "var(--danger)",

        // Percent bars
        percentMid: "var(--percent-mid)",

        // Dark backgrounds
        overlayDark: "var(--overlay-dark)",
        tooltipDark: "var(--tooltip-dark)",

        // Event colors
        eventStorm: "var(--event-storm)",
        eventSunflare: "var(--event-sunflare)",
        eventPests: "var(--event-pests)",
        eventDrought: "var(--event-drought)",

        // Soil colors
        soilLight: "var(--soil-light)",
        soilMid: "var(--soil-mid)",
        soilDark: "var(--soil-dark)",
      },
      backgroundImage: {
        soilGradient: "var(--soil-gradient)",
        soilTexture: "var(--soil-texture)",
      },
      boxShadow: {
        soil: "0 4px 6px var(--soil-shadow), inset 0 2px 4px var(--soil-inner-shadow)",
      },
      animation: {
        pulse: "pulse 1s ease-in-out infinite",
        eventFlash: "eventFlash 2s ease-in-out infinite",
        spin: "spin 1s linear infinite",
      },
      keyframes: {
        pulse: {
          "0%": { opacity: "0.7", transform: "scale(1)" },
          "100%": { opacity: "1", transform: "scale(1.05)" },
        },
        eventFlash: {
          "0%": { opacity: "0" },
          "20%": { opacity: "1" },
          "80%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        spin: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
    },
  },
  plugins: [],
};