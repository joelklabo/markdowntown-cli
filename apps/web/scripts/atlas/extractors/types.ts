import type { AtlasSource } from "../../../src/lib/atlas/sources.ts";
import type { AtlasFeatureId } from "../../../src/lib/atlas/features.ts";
import type { Claim, FeatureSupportLevel } from "../../../src/lib/atlas/types.ts";

export type ExtractorInput = {
  source: AtlasSource;
  html: string;
};

export type ExtractorOutput = {
  claims: Claim[];
  featureSupport: Partial<Record<AtlasFeatureId, FeatureSupportLevel>>;
};

export type AtlasExtractor = {
  sourceId: string;
  extract: (input: ExtractorInput) => Promise<ExtractorOutput> | ExtractorOutput;
};

