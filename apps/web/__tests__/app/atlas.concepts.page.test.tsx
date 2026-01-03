import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

async function fakeRenderMdx(source: string) {
  const lines = source.split(/\r?\n/);
  const headingLine = lines.find((line) => /^#\s+/.test(line.trim()));
  const heading = headingLine ? headingLine.replace(/^#\s+/, "").trim() : "MDX";
  const body = lines
    .filter((line) => !/^#\s+/.test(line.trim()))
    .join("\n")
    .trim();
  return (
    <>
      <h1>{heading}</h1>
      {body ? <p>{body}</p> : null}
    </>
  );
}

const { listAtlasGuideSlugs, loadAtlasGuideMdx } = vi.hoisted(() => ({
  listAtlasGuideSlugs: vi.fn(),
  loadAtlasGuideMdx: vi.fn(),
}));

vi.mock("@/lib/atlas/load", () => ({
  listAtlasGuideSlugs,
  loadAtlasGuideMdx,
}));

const { renderMdx } = vi.hoisted(() => ({
  renderMdx: vi.fn(fakeRenderMdx),
}));

vi.mock("@/lib/mdx/renderMdx", () => ({
  renderMdx,
}));

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound,
}));

import AtlasConceptPage from "@/app/atlas/concepts/[slug]/page";

describe("AtlasConceptPage", () => {
  beforeEach(() => {
    listAtlasGuideSlugs.mockReset();
    loadAtlasGuideMdx.mockReset();
    renderMdx.mockClear();
    renderMdx.mockImplementation(fakeRenderMdx);
    notFound.mockReset();
  });

  it("renders MDX for a known slug", async () => {
    listAtlasGuideSlugs.mockReturnValue(["scoping"]);
    loadAtlasGuideMdx.mockReturnValue("# Scoping\n\nHello world.\n");

    const jsx = await AtlasConceptPage({ params: Promise.resolve({ slug: "scoping" }) });
    render(jsx);

    expect(screen.getByRole("heading", { name: /scoping/i })).toBeInTheDocument();
    expect(screen.getByText(/hello world/i)).toBeInTheDocument();
  });

  it("calls notFound for unknown slug", async () => {
    listAtlasGuideSlugs.mockReturnValue(["scoping"]);
    await AtlasConceptPage({ params: Promise.resolve({ slug: "missing" }) });
    expect(notFound).toHaveBeenCalled();
  });

  it("calls notFound when renderMdx throws", async () => {
    listAtlasGuideSlugs.mockReturnValue(["scoping"]);
    loadAtlasGuideMdx.mockReturnValue("# Scoping\n\nHello world.\n");
    renderMdx.mockRejectedValueOnce(new Error("boom"));
    await AtlasConceptPage({ params: Promise.resolve({ slug: "scoping" }) });
    expect(notFound).toHaveBeenCalled();
  });
});
