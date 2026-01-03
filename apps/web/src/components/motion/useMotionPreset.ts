import { useMemo } from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

type Tier = "micro" | "component" | "panel";

const durations: Record<Tier, string> = {
  micro: "var(--mdt-motion-fast)",
  component: "var(--mdt-motion-base)",
  panel: "var(--mdt-motion-slow)",
};

const distances: Record<Tier, string> = {
  micro: "var(--mdt-motion-distance-short)",
  component: "var(--mdt-motion-distance-mid)",
  panel: "var(--mdt-motion-distance-far)",
};

export type MotionPreset = {
  duration: string;
  easing: string;
  translate: string;
};

export function useMotionPreset(tier: Tier = "component", axis: "x" | "y" = "y"): MotionPreset {
  const prefersReducedMotion = usePrefersReducedMotion();

  return useMemo(
    () => {
      const reducedTranslate = `translate${axis.toUpperCase()}(0px)`;
      return {
        duration: prefersReducedMotion ? "1ms" : durations[tier],
        easing: "var(--mdt-motion-ease-emphasized)",
        translate: prefersReducedMotion ? reducedTranslate : `translate${axis.toUpperCase()}(${distances[tier]})`,
      };
    },
    [tier, axis, prefersReducedMotion]
  );
}
