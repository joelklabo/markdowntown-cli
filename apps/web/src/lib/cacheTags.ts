export const cacheTags = {
  landing: "cache:landing",
  tags: "cache:tags",
  list: (type: "all" | "snippet" | "template" | "file" | "agent" | "skill") => `cache:list:${type}`,
  detail: (type: string, idOrSlug: string) => `cache:detail:${type}:${idOrSlug}`,
};

export type PublicListType = "all" | "snippet" | "template" | "file" | "agent" | "skill";
