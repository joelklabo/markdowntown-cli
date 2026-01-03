import type { StorybookConfig } from "@storybook/nextjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const storybookDir = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx|mdx)", "../src/stories/**/*.stories.@(ts|tsx|mdx)"],
  addons: [
    "@storybook/addon-toolbars",
    "@storybook/addon-backgrounds",
    "@storybook/addon-actions",
    "@storybook/addon-controls",
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-links",
  ],
  framework: {
    name: "@storybook/nextjs",
    options: {},
  },
  docs: {
    autodocs: true,
  },
  staticDirs: ["../public"],
  webpackFinal: async (config) => {
    config.resolve ??= {};
    config.resolve.alias ??= {};
    if (typeof config.resolve.alias === "object" && config.resolve.alias) {
      config.resolve.alias["@"] = path.resolve(storybookDir, "../src");
    }
    return config;
  },
};

export default config;
