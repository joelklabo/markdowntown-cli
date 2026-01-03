"use client";

import { useEffect, useRef } from "react";
import { envPublic } from "@/config/env.public";
const key = envPublic.NEXT_PUBLIC_POSTHOG_KEY;
const host = envPublic.NEXT_PUBLIC_POSTHOG_HOST;

export function PosthogProvider({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false);

  useEffect(() => {
    if (!key || initialized.current) return;
    const load = () =>
      import("posthog-js").then(({ default: ph }) => {
        ph.init(key, {
          api_host: host,
          capture_pageview: true,
          persistence: "memory",
        });
        initialized.current = true;
      });

    const idle = (window as { requestIdleCallback?: typeof requestIdleCallback }).requestIdleCallback;
    const cancelIdle = (window as { cancelIdleCallback?: typeof cancelIdleCallback }).cancelIdleCallback;
    const handle = idle ? idle(load) : window.setTimeout(load, 0);

    return () => {
      if (idle && cancelIdle) {
        cancelIdle(handle as unknown as number);
      } else {
        clearTimeout(handle as unknown as number);
      }
    };
  }, []);

  return <>{children}</>;
}
