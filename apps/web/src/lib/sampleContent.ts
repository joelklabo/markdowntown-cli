export type SampleItemType = "snippet" | "template" | "file" | "agent" | "skill";

export type SampleItem = {
  id: string;
  slug?: string | null;
  title: string;
  description: string;
  tags: string[];
  stats: {
    copies: number;
    views: number;
    votes: number;
  };
  type: SampleItemType;
  badge?: "new" | "trending" | "staff";
};
