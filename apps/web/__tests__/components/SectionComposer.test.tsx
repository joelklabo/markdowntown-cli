import React from "react";
import { render, waitFor, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, type Mock } from "vitest";
import { SectionComposer } from "@/components/SectionComposer";

// Mock next/link for Slot usage inside Button
vi.mock("next/link", () => {
  type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: React.ReactNode;
    href: string;
  };
  const Link = ({ children, href, ...rest }: LinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  return { __esModule: true, default: Link };
});

// Mock react-markdown and remark-gfm to keep render lightweight
vi.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="markdown-preview">{children}</div>
  ),
}));
vi.mock("remark-gfm", () => ({ __esModule: true, default: () => ({}) }));

// Mock next/dynamic to return the component immediately
vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: (loader: () => Promise<{ default: React.ComponentType<unknown> }>) => {
    const Comp = React.lazy(loader);
    return (props: Record<string, unknown>) => (
      <React.Suspense fallback={<div>loading...</div>}>
        <Comp {...props} />
      </React.Suspense>
    );
  },
}));

type TestSection = { id: string; title: string; content: string; order: number; tags: string[] };

const initialSection: TestSection = {
  id: "1",
  title: "Hello",
  content: "# Hi",
  order: 1,
  tags: ["style"],
};

const sections: TestSection[] = [
  { ...initialSection },
];

type MockResponse = { ok: boolean; json: () => Promise<unknown> };

function mockFetch() {
  let call = 0;
  global.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
    // first call load, second POST create
    if (!init) {
      return { ok: true, json: async () => sections } satisfies MockResponse;
    }
    const payload = init.body ? JSON.parse(init.body as string) : {};
    if (init.method === "POST") {
      call += 1;
      const created = {
        id: `new-${call}`,
        title: payload.title ?? "Untitled section",
        content: payload.content ?? "",
        order: sections.length + call,
        tags: payload.tags ?? [],
      };
      sections.push(created);
      return {
        ok: true,
        json: async () => created,
      } satisfies MockResponse;
    }
    if (init.method === "PUT") {
      const updated = { ...sections[0], ...payload };
      sections[0] = updated;
      return { ok: true, json: async () => updated } satisfies MockResponse;
    }
    return { ok: true, json: async () => ({}) } satisfies MockResponse;
  }) as unknown as typeof fetch;
}

describe("SectionComposer", () => {
  beforeEach(() => {
    sections.length = 0;
    sections.push({ ...initialSection });
    mockFetch();
  });

  it("loads sections and shows preview text", async () => {
    render(<SectionComposer />);

    await screen.findByText("Hello");
    await screen.findByTestId("markdown-preview");
    expect(screen.getByTestId("markdown-preview").textContent).toContain("Hi");
  });

  it("adds a new section when Add is clicked", async () => {
    render(<SectionComposer />);
    const addButtons = await screen.findAllByRole("button", { name: /add/i });
    await userEvent.click(addButtons[0]);

    await waitFor(() => {
      const calls = (fetch as unknown as Mock).mock.calls as [string, RequestInit | undefined][];
      expect(calls.some(([, init]) => init?.method === "POST")).toBe(true);
    });
  });

  it("normalizes tag input and saves on blur", async () => {
    render(<SectionComposer />);
    const tagField = await screen.findByLabelText(/tags/i);
    await screen.findByText("Hello");
    await waitFor(() => expect(tagField).not.toBeDisabled());

    await userEvent.type(tagField, ", System Prompt");
    await act(async () => {
      tagField.blur();
    });

    await waitFor(() => {
      const calls = (fetch as unknown as Mock).mock.calls as [string, RequestInit | undefined][];
      const putCall = calls.find(([, init]) => init?.method === "PUT");
      expect(putCall).toBeDefined();
      const body = JSON.parse(putCall?.[1]?.body as string);
      expect(body.tags).toEqual(["style", "system-prompt"]);
    });
  });
});
