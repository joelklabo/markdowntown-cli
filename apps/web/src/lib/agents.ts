export type AgentContext = {
  userId?: string;
  sections: { id: string; title: string; content: string }[];
};

export type AgentPlugin = {
  id: string;
  name: string;
  description?: string;
  run: (ctx: AgentContext) => Promise<string> | string;
};

// Example plugin that concatenates section titles
export const sampleAgent: AgentPlugin = {
  id: "sample-agent",
  name: "Sample Agent",
  description: "Returns a summary list of section titles.",
  run: ({ sections }) =>
    sections.map((s, i) => `${i + 1}. ${s.title || "Untitled"}`).join("\n"),
};
