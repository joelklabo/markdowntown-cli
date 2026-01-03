"use client";

import dynamic from "next/dynamic";
import type { FC, ReactNode } from "react";

const hasPosthog = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);

let PosthogWrapper: FC<{ children: ReactNode }> = function PosthogPassthrough({ children }) {
  return <>{children}</>;
};

if (hasPosthog) {
  const LazyPosthog = dynamic(() => import("./PosthogProvider").then((m) => m.PosthogProvider), {
    ssr: false,
    loading: () => null,
  });
  PosthogWrapper = function PosthogWithAnalytics({ children }) {
    return <LazyPosthog>{children}</LazyPosthog>;
  };
}

export function PosthogProviderLazy({ children }: { children: ReactNode }) {
  return <PosthogWrapper>{children}</PosthogWrapper>;
}
