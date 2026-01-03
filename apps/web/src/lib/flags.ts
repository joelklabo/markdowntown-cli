function envBool(value: string | undefined) {
  return value === "1" || value === "true";
}

function envBoolDefaultTrue(value: string | undefined) {
  if (value === undefined) return true;
  if (value === "0" || value === "false") return false;
  return envBool(value);
}

const isServer = typeof window === "undefined";

export const featureFlags = {
  publicLibrary: isServer && envBool(process.env.PUBLIC_LIBRARY),
  themeRefreshV1: envBool(process.env.NEXT_PUBLIC_THEME_REFRESH_V1),
  uxClarityV1: envBool(process.env.NEXT_PUBLIC_UX_CLARITY_V1),
  headerStabilityV1: envBool(process.env.NEXT_PUBLIC_HEADER_STABILITY_V1),
  instructionHealthV1: envBool(process.env.NEXT_PUBLIC_INSTRUCTION_HEALTH_V1),
  scanClarityV1: envBool(process.env.NEXT_PUBLIC_SCAN_CLARITY_V1),
  scanNextStepsV1: envBool(process.env.NEXT_PUBLIC_SCAN_NEXT_STEPS_V1),
  scanQuickUploadV1: envBool(process.env.NEXT_PUBLIC_SCAN_QUICK_UPLOAD_V1),
  wordmarkAnimV1: envBoolDefaultTrue(process.env.NEXT_PUBLIC_WORDMARK_ANIM_V1),
  wordmarkBannerV1: envBoolDefaultTrue(process.env.NEXT_PUBLIC_WORDMARK_BANNER_V1),
};
