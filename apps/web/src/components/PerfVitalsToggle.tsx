"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

const enableRUM = process.env.NEXT_PUBLIC_ENABLE_RUM === "true";

let PerfComponent: ComponentType = function PerfComponentNull() {
  return null;
};

if (enableRUM) {
  const LazyPerf = dynamic(() => import("./PerfVitals").then((m) => m.PerfVitals), {
    ssr: false,
  });
  PerfComponent = function PerfComponentLoaded() {
    return <LazyPerf />;
  };
}

export function PerfVitalsToggle() {
  return <PerfComponent />;
}
