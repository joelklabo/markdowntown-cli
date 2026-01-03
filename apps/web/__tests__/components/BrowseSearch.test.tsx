import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { BrowseSearch } from "@/components/browse/BrowseSearch";

const replaceMock = vi.fn();
const mockSearchParams = new URLSearchParams("sort=top");

vi.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => mockSearchParams,
}));

describe("BrowseSearch", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    mockSearchParams.set("sort", "top");
  });

  it("debounces updates and preserves base params", async () => {
    const user = userEvent.setup();
    render(<BrowseSearch initialQuery="" baseQueryString="type=snippet" debounceMs={10} />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalled());
    replaceMock.mockClear();

    const input = screen.getByRole("searchbox", { name: /search library/i });
    expect(input).toHaveAttribute("placeholder", "Search snippets, templates…");
    await user.type(input, "hello");

    await waitFor(() =>
      expect(
        replaceMock.mock.calls.some(([path]) => typeof path === "string" && path.includes("hello"))
      ).toBe(true)
    );

    const helloCall = replaceMock.mock.calls.find(
      ([path]) => typeof path === "string" && path.includes("hello")
    );
    const [path, options] = helloCall ?? [];
    expect(options).toMatchObject({ scroll: false });
    const url = new URL(`http://localhost${path}`);
    expect(url.pathname).toBe("/browse");
    expect(url.searchParams.get("q")).toBe("hello");
    expect(url.searchParams.get("type")).toBe("snippet");
    expect(url.searchParams.get("sort")).toBe("top");
  });

  it("removes q param when cleared", async () => {
    const user = userEvent.setup();
    render(<BrowseSearch initialQuery="seed" baseQueryString="type=template" debounceMs={10} />);

    const input = screen.getByRole("searchbox", { name: /search library/i });
    await user.clear(input);

    await waitFor(() => expect(replaceMock).toHaveBeenCalled());

    const [path] = replaceMock.mock.calls.at(-1)!;
    const url = new URL(`http://localhost${path}`);
    expect(url.searchParams.get("q")).toBeNull();
    expect(url.searchParams.get("type")).toBe("template");
  });
});
