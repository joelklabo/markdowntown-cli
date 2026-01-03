import type { Preview } from "@storybook/react";
import React, { useEffect } from "react";
import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "surface",
      values: [
        { name: "surface", value: "var(--mdt-color-surface)" },
        { name: "subtle", value: "var(--mdt-color-surface-subtle)" },
        { name: "dark", value: "hsl(220 18% 10%)" },
      ],
    },
  },
  globalTypes: {
    theme: {
      name: "Theme",
      description: "Light or dark theme",
      defaultValue: "light",
      toolbar: {
        icon: "circlehollow",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme as "light" | "dark";
      useEffect(() => {
        const root = document.documentElement;
        if (theme === "dark") root.classList.add("dark");
        else root.classList.remove("dark");
        window.localStorage.setItem("theme", theme);
      }, [theme]);
      return <Story />;
    },
  ],
};

export default preview;
