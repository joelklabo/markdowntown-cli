import type {
  ArtifactSpec,
  Claim,
  ClaimConfidence,
  FeatureSupportLevel,
  PlatformFacts,
} from "../../src/lib/atlas/types.ts";

type NormalizedEvidence = {
  url: string;
  title?: string;
  excerpt?: string;
};

type NormalizedClaim = {
  statement: string;
  confidence: ClaimConfidence;
  evidence: NormalizedEvidence[];
  features?: string[];
  artifacts?: string[];
};

export type FactsSnapshot = {
  platformId: PlatformFacts["platformId"];
  name: string;
  docHome?: string;
  artifacts: ArtifactSpec[];
  featureSupport: Record<string, FeatureSupportLevel>;
  claims: Record<string, NormalizedClaim>;
};

export type ConfidenceChange = {
  claimId: string;
  before: ClaimConfidence;
  after: ClaimConfidence;
};

export type FeatureSupportChange = {
  featureId: string;
  before: FeatureSupportLevel | undefined;
  after: FeatureSupportLevel | undefined;
};

export type FactsDiff = {
  platformId: PlatformFacts["platformId"];
  before: FactsSnapshot | null;
  after: FactsSnapshot | null;
  addedClaimIds: string[];
  removedClaimIds: string[];
  changedClaimIds: string[];
  confidenceChanges: ConfidenceChange[];
  featureSupportChanges: FeatureSupportChange[];
  hasChanges: boolean;
};

function normalizeEvidence(evidence: Claim["evidence"]): NormalizedEvidence[] {
  return evidence
    .map((item) => ({
      url: item.url,
      title: item.title,
      excerpt: item.excerpt,
    }))
    .sort((a, b) => a.url.localeCompare(b.url) || (a.title ?? "").localeCompare(b.title ?? "") || (a.excerpt ?? "").localeCompare(b.excerpt ?? ""));
}

function normalizeStringArray(values?: string[]): string[] | undefined {
  if (!values) return undefined;
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  if (normalized.length === 0) return undefined;
  normalized.sort();
  return normalized;
}

function normalizeClaim(claim: Claim): NormalizedClaim {
  return {
    statement: claim.statement,
    confidence: claim.confidence,
    evidence: normalizeEvidence(claim.evidence),
    features: normalizeStringArray(claim.features),
    artifacts: normalizeStringArray(claim.artifacts),
  };
}

function normalizeFeatureSupport(record: Record<string, FeatureSupportLevel>): Record<string, FeatureSupportLevel> {
  const out: Record<string, FeatureSupportLevel> = {};
  for (const key of Object.keys(record).sort()) {
    out[key] = record[key];
  }
  return out;
}

function normalizeArtifacts(artifacts: ArtifactSpec[]): ArtifactSpec[] {
  const normalized = artifacts.map((artifact) => ({
    ...artifact,
    paths: Array.from(new Set(artifact.paths.map((p) => p.trim()).filter(Boolean))).sort(),
  }));
  normalized.sort((a, b) => a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label));
  return normalized;
}

export function snapshotFacts(facts: PlatformFacts): FactsSnapshot {
  const claims = [...(facts.claims ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  const outClaims: Record<string, NormalizedClaim> = {};
  for (const claim of claims) {
    outClaims[claim.id] = normalizeClaim(claim);
  }

  return {
    platformId: facts.platformId,
    name: facts.name,
    docHome: facts.docHome,
    artifacts: normalizeArtifacts(facts.artifacts ?? []),
    featureSupport: normalizeFeatureSupport(facts.featureSupport ?? {}),
    claims: outClaims,
  };
}

function claimFingerprint(value: NormalizedClaim): string {
  return JSON.stringify(value);
}

export function diffPlatformFacts(before: PlatformFacts | null, after: PlatformFacts | null): FactsDiff {
  const platformId = (after ?? before)?.platformId;
  if (!platformId) {
    throw new Error("diffPlatformFacts requires at least one PlatformFacts object.");
  }

  const beforeSnap = before ? snapshotFacts(before) : null;
  const afterSnap = after ? snapshotFacts(after) : null;

  const beforeClaims = beforeSnap?.claims ?? {};
  const afterClaims = afterSnap?.claims ?? {};

  const beforeIds = new Set(Object.keys(beforeClaims));
  const afterIds = new Set(Object.keys(afterClaims));

  const addedClaimIds: string[] = [];
  const removedClaimIds: string[] = [];
  const changedClaimIds: string[] = [];
  const confidenceChanges: ConfidenceChange[] = [];

  for (const id of Array.from(afterIds).sort()) {
    if (!beforeIds.has(id)) addedClaimIds.push(id);
  }
  for (const id of Array.from(beforeIds).sort()) {
    if (!afterIds.has(id)) removedClaimIds.push(id);
  }

  const sharedIds = Array.from(new Set([...Array.from(beforeIds), ...Array.from(afterIds)])).sort();
  for (const id of sharedIds) {
    const beforeClaim = beforeClaims[id];
    const afterClaim = afterClaims[id];
    if (!beforeClaim || !afterClaim) continue;

    if (claimFingerprint(beforeClaim) !== claimFingerprint(afterClaim)) {
      changedClaimIds.push(id);
      if (beforeClaim.confidence !== afterClaim.confidence) {
        confidenceChanges.push({ claimId: id, before: beforeClaim.confidence, after: afterClaim.confidence });
      }
    }
  }

  const featureSupportChanges: FeatureSupportChange[] = [];
  const beforeSupport = beforeSnap?.featureSupport ?? {};
  const afterSupport = afterSnap?.featureSupport ?? {};
  const supportKeys = new Set([...Object.keys(beforeSupport), ...Object.keys(afterSupport)]);
  for (const featureId of Array.from(supportKeys).sort()) {
    const beforeValue = beforeSupport[featureId];
    const afterValue = afterSupport[featureId];
    if (beforeValue !== afterValue) {
      featureSupportChanges.push({ featureId, before: beforeValue, after: afterValue });
    }
  }

  const hasChanges =
    addedClaimIds.length > 0 ||
    removedClaimIds.length > 0 ||
    changedClaimIds.length > 0 ||
    confidenceChanges.length > 0 ||
    featureSupportChanges.length > 0 ||
    JSON.stringify(beforeSnap?.artifacts ?? []) !== JSON.stringify(afterSnap?.artifacts ?? []) ||
    (beforeSnap?.name ?? null) !== (afterSnap?.name ?? null) ||
    (beforeSnap?.docHome ?? null) !== (afterSnap?.docHome ?? null);

  return {
    platformId,
    before: beforeSnap,
    after: afterSnap,
    addedClaimIds,
    removedClaimIds,
    changedClaimIds,
    confidenceChanges,
    featureSupportChanges,
    hasChanges,
  };
}

