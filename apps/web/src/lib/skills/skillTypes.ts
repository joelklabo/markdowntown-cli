import type { UamCapabilityV1, UamV1 } from "@/lib/uam/uamTypes";

export type SkillCapabilitySummary = Pick<UamCapabilityV1, "id" | "title" | "description">;

export type PublicSkillSummary = {
  id: string;
  slug?: string | null;
  title: string;
  description: string;
  tags: string[];
  targets: string[];
  capabilityCount: number;
  capabilities: SkillCapabilitySummary[];
  createdAt: Date;
  updatedAt: Date;
};

export type PublicSkillDetail = PublicSkillSummary & {
  content: UamV1;
  version: string;
};

export type ListPublicSkillsInput = {
  limit?: number;
  tags?: unknown;
  targets?: unknown;
  sort?: "recent" | "views" | "copies";
  search?: string | null;
};
