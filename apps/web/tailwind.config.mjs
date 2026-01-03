/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx}",
    "./src/stories/**/*.{js,ts,jsx,tsx,mdx}",
    "./.storybook/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      transitionDuration: {
        "mdt-fast": "var(--mdt-motion-fast)",
        "mdt-base": "var(--mdt-motion-base)",
        "mdt-slow": "var(--mdt-motion-slow)",
      },
      transitionTimingFunction: {
        "mdt-standard": "var(--mdt-motion-ease-standard)",
        "mdt-emphasized": "var(--mdt-motion-ease-emphasized)",
        "mdt-snappy": "var(--mdt-motion-ease-snappy)",
      },
      spacing: {
        "mdt-11": "var(--mdt-space-11)",
        "mdt-12": "var(--mdt-space-12)",
        "mdt-13": "var(--mdt-space-13)",
        "mdt-14": "var(--mdt-space-14)",
        "mdt-15": "var(--mdt-space-15)",
        "mdt-16": "var(--mdt-space-16)",
      },
    },
  },
  plugins: [],
};

export default config;
