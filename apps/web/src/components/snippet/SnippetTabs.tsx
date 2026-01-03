"use client";

import { DetailTabs } from "@/components/detail/DetailTabs";

type Props = {
  title: string;
  rendered: string;
  raw: string;
};

export function SnippetTabs(props: Props) {
  return <DetailTabs {...props} copyLabel="Copy" />;
}
