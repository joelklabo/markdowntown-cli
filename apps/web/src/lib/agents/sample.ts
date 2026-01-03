import { AgentPlugin } from "../agents";

export const sampleContentAgent: AgentPlugin = {
  id: "sample-content-agent",
  name: "Sample Content Agent",
  description: "Generates a simple outline based on existing sections.",
  run: ({ sections }) => {
    const titles = sections.map((s) => s.title || "Untitled");
    return [`# Town Outline`, ...titles.map((t, i) => `${i + 1}. ${t}`)].join("\n");
  },
};
