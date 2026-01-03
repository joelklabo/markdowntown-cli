"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

type MetricPayload = Record<string, unknown>;

declare global {
  interface Window {
    posthog?: { capture: (event: string, payload: MetricPayload) => void };
  }
}

const SAMPLE_RATE = 0.35;
const API_SAMPLE_RATE = 0.15;

const perfBudgets: Record<string, { lcp: number; cls: number }> = {
  "/": { lcp: 3500, cls: 0.1 },
  "/browse": { lcp: 4000, cls: 0.1 },
  "/library": { lcp: 4000, cls: 0.1 },
  "/atlas": { lcp: 4000, cls: 0.1 },
  "/builder": { lcp: 4200, cls: 0.1 },
  "/translate": { lcp: 3500, cls: 0.1 },
  "/docs": { lcp: 3200, cls: 0.1 },
  "/templates": { lcp: 3500, cls: 0.1 },
  "/snippets": { lcp: 3500, cls: 0.1 },
};

function emit(event: string, data: MetricPayload) {
  if (typeof window === "undefined") return;
  const payload = { event, ...data };
  if (window.posthog?.capture) {
    window.posthog.capture(event, payload);
  } else {
    console.debug("[perf]", payload);
  }
}

function deviceContext(path: string) {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const connection = (nav as unknown as { connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean } })?.connection;
  return {
    path,
    ua: nav?.userAgent,
    locale: nav?.language,
    deviceMemory: (nav as unknown as { deviceMemory?: number }).deviceMemory,
    cores: nav?.hardwareConcurrency,
    effectiveType: connection?.effectiveType,
    downlink: connection?.downlink,
    rtt: connection?.rtt,
    saveData: connection?.saveData,
  };
}

function budgetFor(path: string) {
  const match = Object.keys(perfBudgets).find((key) => (key === "/" ? path === key : path.startsWith(key)));
  return match ? perfBudgets[match] : { lcp: 4000, cls: 0.1 };
}

export function PerfVitals() {
  const pathname = usePathname();
  const navStart = useRef<number>(typeof performance !== "undefined" ? performance.now() : 0);

  useEffect(() => {
    navStart.current = typeof performance !== "undefined" ? performance.now() : 0;
    const shouldSample = Math.random() <= SAMPLE_RATE;
    if (!shouldSample || typeof window === "undefined" || typeof performance === "undefined") return;

    let cancelled = false;

    const context = deviceContext(pathname);

    const navEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (navEntry) {
      const cacheHint = navEntry.serverTiming?.find((t) => t.name === "cache")?.description ?? null;
      emit("perf_navigation", {
        ...context,
        ttfb: Math.round(navEntry.responseStart),
        domContentLoaded: Math.round(navEntry.domContentLoadedEventEnd),
        loadEvent: Math.round(navEntry.loadEventEnd),
        transferSize: navEntry.transferSize,
        encodedBodySize: navEntry.encodedBodySize,
        decodedBodySize: navEntry.decodedBodySize,
        cache: cacheHint,
      });
    }

    void import("web-vitals")
      .then(({ onFCP, onLCP, onCLS, onINP, onTTFB }) => {
        if (cancelled) return;
        const budget = budgetFor(pathname ?? "/");
        onFCP((metric) => emit("web_vital_fcp", { ...context, value: Math.round(metric.value) }));
        onLCP((metric) => {
          const value = Math.round(metric.value);
          emit("web_vital_lcp", { ...context, value });
          if (value > budget.lcp) emit("perf_budget_violation", { ...context, metric: "lcp", value, budget: budget.lcp });
        });
        onCLS((metric) => {
          const value = Number(metric.value.toFixed(4));
          emit("web_vital_cls", { ...context, value });
          if (value > budget.cls) emit("perf_budget_violation", { ...context, metric: "cls", value, budget: budget.cls });
        });
        onINP((metric) => emit("web_vital_inp", { ...context, value: Math.round(metric.value) }));
        onTTFB((metric) => {
          const entry = metric?.entries?.[0] as PerformanceNavigationTiming | undefined;
          const cache = entry?.serverTiming?.find?.((t) => t.name === "cache")?.description ?? null;
          emit("web_vital_ttfb", { ...context, value: Math.round(metric.value), cache });
        });
      })
      .catch(() => {});

    // Approximate SPA nav timing (time to idle after route change)
    const idle = window.requestIdleCallback || ((cb: () => void) => window.setTimeout(cb, 0));
    const idleId = idle(() => {
      const duration = performance.now() - navStart.current;
      emit("spa_nav", { ...context, duration: Math.round(duration) });
    });

    // Sample API/fetch latency for current view
    let apiSamples = 0;
    const resourceObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (apiSamples >= 5) return;
        if (Math.random() > API_SAMPLE_RATE) return;
        if (entry.entryType !== "resource") return;
        const res = entry as PerformanceResourceTiming;
        if (res.initiatorType === "fetch" || res.initiatorType === "xmlhttprequest") {
          apiSamples += 1;
          const cacheHint = res.serverTiming?.find?.((t) => t.name === "cache")?.description ?? null;
          emit("perf_api", {
            ...context,
            name: res.name,
            duration: Math.round(res.duration),
            ttfb: Math.round(res.responseStart - res.startTime),
            transferSize: res.transferSize,
            cache: cacheHint,
          });
        }
      });
    });

    try {
      resourceObserver.observe({ type: "resource", buffered: true });
    } catch {
      // ignore
    }

    // Flush CLS when tab closes if web-vitals didn't already
    const onHide = () => emit("web_vital_cls_flush", { ...context, visibility: document.visibilityState });
    document.addEventListener("visibilitychange", onHide);

    return () => {
      cancelled = true;
      resourceObserver.disconnect();
      document.removeEventListener("visibilitychange", onHide);
      if (window.cancelIdleCallback) window.cancelIdleCallback(idleId);
      else clearTimeout(idleId as number);
    };
  }, [pathname]);

  return null;
}
