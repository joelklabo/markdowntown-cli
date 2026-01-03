"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { LivingCityWordmark } from "./wordmark/LivingCityWordmark";
import { NavActiveIndicator } from "./nav/NavActiveIndicator";
import { Button } from "./ui/Button";
import { Container } from "./ui/Container";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "./ui/Sheet";
import { ThemeToggle } from "./ThemeToggle";
import { DensityToggle } from "./DensityToggle";
import { COMMAND_PALETTE_OPEN_EVENT } from "./CommandPalette";
import { AtlasIcon, LibraryIcon, MenuIcon, SearchIcon, TranslateIcon, WorkbenchIcon, type NavIconProps } from "./icons/NavIcons";
import { emitCityWordmarkEvent } from "./wordmark/sim/bridge";
import { track } from "@/lib/analytics";
import { cn, focusRing, interactiveBase } from "@/lib/cn";
import { featureFlags } from "@/lib/flags";

const links = [
  { href: "/atlas/simulator", label: "Scan" },
  { href: "/workbench", label: "Workbench", title: "Build agents.md in Workbench" },
  { href: "/library", label: "Library" },
  { href: "/translate", label: "Translate" },
  { href: "/docs", label: "Docs" },
];

type User = { name?: string | null; username?: string | null; email?: string | null; image?: string | null } | null;

export function SiteNav({ user, sticky = true }: { user?: User; sticky?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showOverflowSheet, setShowOverflowSheet] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mobileSearchReturnFocusRef = useRef<HTMLElement | null>(null);
  const overflowReturnFocusRef = useRef<HTMLElement | null>(null);
  const suppressMobileSearchRestoreRef = useRef(false);
  const suppressOverflowRestoreRef = useRef(false);
  const desktopNavRef = useRef<HTMLElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const ctaHref = "/atlas/simulator";

  function openCommandPalette(origin: string) {
    track("command_palette_entry_click", { origin });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_OPEN_EVENT, { detail: { origin } }));
    }
  }

  const openMobileSearch = useCallback((source: string, trigger?: HTMLElement | null) => {
    mobileSearchReturnFocusRef.current =
      trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setShowOverflowSheet((wasOpen) => {
      if (wasOpen) suppressOverflowRestoreRef.current = true;
      return false;
    });
    setShowMobileSearch(true);
    track("nav_search_open", { source });
  }, []);

  const openOverflowMenu = useCallback((trigger?: HTMLElement | null) => {
    overflowReturnFocusRef.current =
      trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setShowMobileSearch((wasOpen) => {
      if (wasOpen) suppressMobileSearchRestoreRef.current = true;
      return false;
    });
    setShowOverflowSheet(true);
  }, []);

  function persistRecent(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const next = [trimmed, ...prev.filter((v) => v !== trimmed)].slice(0, 6);
      try {
        localStorage.setItem("mdt_recent_searches", JSON.stringify(next));
      } catch {
        /* noop */
      }
      return next;
    });
  }

  function buildBrowseHref(overrides?: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const q = query.trim();
    if (q) params.set("q", q);
    Object.entries(overrides ?? {}).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const search = params.toString();
    return search ? `/library?${search}` : "/library";
  }

  function buildSearchEventQuery(overrides?: Record<string, string | undefined>) {
    const trimmed = query.trim();
    if (trimmed) return trimmed;
    const tokens = Object.entries(overrides ?? {})
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}:${value}`);
    if (tokens.length > 0) return tokens.join(" ");
    return "browse";
  }

  function applyQuickFilter(overrides: Record<string, string>, source: string) {
    const destination = buildBrowseHref(overrides);
    const q = query.trim();
    persistRecent(q);
    track("nav_search_quick_filter", { source, q: q || undefined, ...overrides });
    emitCityWordmarkEvent({ type: "search", query: buildSearchEventQuery(overrides) });
    router.push(destination);
    setShowMobileSearch(false);
    setShowOverflowSheet(false);
  }

  function onSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = query.trim();
    persistRecent(q);
    track("nav_search_submit", { q });
    if (q) emitCityWordmarkEvent({ type: "search", query: q });
    router.push(buildBrowseHref());
    setShowMobileSearch(false);
    setShowOverflowSheet(false);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        const isDesktop = window.matchMedia?.("(min-width: 768px)")?.matches ?? false;
        if (isDesktop) {
          inputRef.current?.focus();
          inputRef.current?.select();
        } else {
          openMobileSearch("slash");
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openMobileSearch]);

  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated) return;
    try {
      const stored = localStorage.getItem("mdt_recent_searches");
      if (stored) {
        const parsed = JSON.parse(stored);
        setRecentSearches(parsed);
      }
    } catch {
      // ignore
    } finally {
      setHydrated(true);
    }
  }, [hydrated]);

  useEffect(() => {
    if (pathname.startsWith("/labs/city-logo")) return;
    const headerEl = headerRef.current;
    if (!headerEl) return;
    const bannerEl = headerEl.querySelector<HTMLElement>(".mdt-site-header-banner");
    const navEl = headerEl.querySelector<HTMLElement>(".mdt-site-header-nav");
    if (!bannerEl || !navEl) return;

    const root = document.documentElement;
    const collapseThreshold = 6;
    const guardDurationMs = 18_000;
    const readHeight = (el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      if (Number.isFinite(rect.height) && rect.height > 0) return rect.height;
      const offset = el.offsetHeight;
      return Number.isFinite(offset) ? offset : 0;
    };
    const readMinHeight = (el: HTMLElement, fallback: number) => {
      const raw = getComputedStyle(el).minHeight || "";
      const parsed = parseFloat(raw);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
      return fallback;
    };
    const resolveMinHeights = () => {
      const isDesktop = window.matchMedia?.("(min-width: 768px)")?.matches ?? false;
      const bannerFallback = isDesktop ? 56 : 48;
      const navFallback = isDesktop ? 64 : 56;
      return {
        bannerMin: readMinHeight(bannerEl, bannerFallback),
        navMin: readMinHeight(navEl, navFallback),
      };
    };
    const clearLocks = () => {
      bannerEl.style.removeProperty("min-height");
      bannerEl.style.removeProperty("height");
      navEl.style.removeProperty("min-height");
      navEl.style.removeProperty("height");
    };
    const applyBannerLock = (height: number) => {
      if (!Number.isFinite(height) || height <= 0) return;
      bannerEl.style.minHeight = `${height}px`;
      bannerEl.style.height = `${height}px`;
    };
    const applyNavLock = (height: number) => {
      if (!Number.isFinite(height) || height <= 0) return;
      navEl.style.minHeight = `${height}px`;
      navEl.style.removeProperty("height");
    };

    const initial = resolveMinHeights();
    let stableBanner = Math.max(readHeight(bannerEl), initial.bannerMin);
    let stableNav = Math.max(readHeight(navEl), initial.navMin);

    const measure = (force = false) => {
      if (root.dataset.headerLab === "true") {
        clearLocks();
        return;
      }
      const { bannerMin, navMin } = resolveMinHeights();
      const bannerHeight = readHeight(bannerEl);
      const navHeight = readHeight(navEl);

      stableBanner = Math.max(stableBanner, bannerMin, bannerHeight);
      stableNav = Math.max(stableNav, navMin, navHeight);

      const bannerCollapsed = stableBanner > 0 && bannerHeight + collapseThreshold < stableBanner;
      const navCollapsed = stableNav > 0 && navHeight + collapseThreshold < stableNav;

      if (bannerCollapsed || (force && bannerHeight < bannerMin)) {
        applyBannerLock(Math.max(stableBanner, bannerMin));
      } else {
        applyBannerLock(Math.max(stableBanner, bannerMin));
      }

      if (navCollapsed || (force && navHeight < navMin)) {
        applyNavLock(Math.max(stableNav, navMin));
      } else {
        applyNavLock(Math.max(stableNav, navMin));
      }
    };

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => measure()) : null;
    observer?.observe(bannerEl);
    observer?.observe(navEl);

    const rootObserver =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver(() => measure(true))
        : null;
    rootObserver?.observe(root, {
      attributes: true,
      attributeFilter: ["style", "data-density", "data-theme", "data-header-lab"],
    });

    const media = window.matchMedia?.("(min-width: 768px)");
    const onMediaChange = () => measure(true);
    if (media) {
      if (media.addEventListener) {
        media.addEventListener("change", onMediaChange);
      } else if (media.addListener) {
        media.addListener(onMediaChange);
      }
    }

    const guardStarted = performance.now();
    const guardInterval = window.setInterval(() => {
      if (performance.now() - guardStarted > guardDurationMs) {
        window.clearInterval(guardInterval);
        return;
      }
      measure(true);
    }, 1500);

    const lateCheck = window.setTimeout(() => measure(true), 5200);
    requestAnimationFrame(() => measure(true));

    if (document.fonts?.ready) {
      void document.fonts.ready.then(() => measure(true)).catch(() => {});
    }

    return () => {
      observer?.disconnect();
      rootObserver?.disconnect();
      window.clearTimeout(lateCheck);
      window.clearInterval(guardInterval);
      if (media) {
        if (media.removeEventListener) {
          media.removeEventListener("change", onMediaChange);
        } else if (media.removeListener) {
          media.removeListener(onMediaChange);
        }
      }
      clearLocks();
    };
  }, [pathname]);

  type BottomNavIcon = ComponentType<NavIconProps>;
  type BottomNavItem =
    | { href: string; label: string; icon: BottomNavIcon; type: "link" }
    | { label: string; icon: BottomNavIcon; type: "search" };

  const bottomNavItems: BottomNavItem[] = [
    { href: "/atlas/simulator", label: "Scan", icon: AtlasIcon, type: "link" },
    { href: "/workbench", label: "Workbench", icon: WorkbenchIcon, type: "link" },
    { href: "/library", label: "Library", icon: LibraryIcon, type: "link" },
    { href: "/translate", label: "Translate", icon: TranslateIcon, type: "link" },
    { href: "/docs", label: "Docs", icon: MenuIcon, type: "link" },
  ];

  const quickFilters: Array<{ label: string; params: Record<string, string> }> = [
    { label: "Trending", params: { sort: "trending" } },
    { label: "Snippets", params: { type: "snippet" } },
    { label: "Templates", params: { type: "template" } },
    { label: "agents.md", params: { type: "file" } },
  ];

  const overflowLinks: Array<{ href: string; label: string; external?: boolean }> = [
    { href: "/docs", label: "Docs" },
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
  ];

  return (
    <>
      <header
        ref={headerRef}
        className={cn(
          "z-30 border-b border-mdt-border-strong bg-mdt-surface backdrop-blur-lg shadow-mdt-md",
          sticky && "sticky top-0"
        )}
      >
        <div className="border-b border-mdt-border-strong bg-mdt-surface-subtle">
          <div className="w-full overflow-hidden">
            <div className="mdt-site-header-banner bg-mdt-surface-subtle">
              {featureFlags.wordmarkBannerV1 ? (
                <LivingCityWordmark
                  className="mdt-wordmark--banner"
                  containerClassName="h-full"
                  sizeMode="fluid"
                  preserveAspectRatio="xMinYMid slice"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Link
                    href="/"
                    className={cn(
                      "text-caption font-semibold uppercase tracking-[0.4em] text-mdt-muted",
                      interactiveBase,
                      focusRing,
                      "rounded-mdt-md px-mdt-3 py-mdt-1 hover:text-mdt-text"
                    )}
                    aria-label="mark downtown"
                  >
                    mark downtown
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
        <Container
          as="div"
          padding="sm"
          className="mdt-site-header-nav grid grid-cols-1 items-center gap-y-mdt-3 gap-x-mdt-4 lg:grid-cols-[minmax(0,1fr),auto]"
        >
          <nav
            ref={desktopNavRef}
            className="relative hidden w-full items-center justify-start gap-mdt-3 text-body-sm font-medium text-mdt-muted md:flex lg:gap-mdt-4"
            aria-label="Primary"
          >
            <NavActiveIndicator containerRef={desktopNavRef} activeKey={pathname} />
            {links.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  title={link.title}
                  className={cn(
                    "rounded-mdt-md px-mdt-3 py-mdt-2",
                    interactiveBase,
                    focusRing,
                    active
                      ? "bg-mdt-surface-strong text-mdt-text shadow-mdt-sm"
                      : "hover:bg-mdt-surface-subtle hover:text-mdt-text"
                  )}
                  data-nav-active={active ? "true" : undefined}
                  onClick={() => track("nav_click", { href: link.href, placement: "desktop" })}
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex min-w-0 flex-wrap items-center gap-2 lg:flex-nowrap">
            <form
              role="search"
              onSubmit={onSearch}
              className="hidden min-w-[220px] flex-1 items-center gap-mdt-2 rounded-mdt-md border border-mdt-border bg-mdt-surface-raised px-mdt-3 py-mdt-2 text-body-sm shadow-mdt-sm transition duration-mdt-fast ease-mdt-standard focus-within:border-mdt-border-strong focus-within:shadow-mdt-md md:flex lg:max-w-[420px]"
            >
              <input
                name="q"
                className="w-full bg-transparent text-mdt-text outline-none placeholder:text-mdt-muted"
                placeholder="Search library…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search"
                ref={inputRef}
                aria-keyshortcuts="/"
              />
              <Button type="submit" size="sm">
                Search
              </Button>
            </form>
            <div className="hidden items-center gap-2 md:flex lg:ml-auto">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="hidden whitespace-nowrap lg:inline-flex"
                onClick={() => openCommandPalette("desktop_nav_button")}
                aria-keyshortcuts="Meta+K,Control+K"
              >
                Command <span className="text-caption text-mdt-muted">⌘K</span>
              </Button>
              <div className="hidden lg:block">
                <DensityToggle mode="icon" />
              </div>
              <div className="hidden md:block">
                <ThemeToggle />
              </div>
              {user ? (
                <div className="hidden min-w-0 items-center gap-2 rounded-mdt-pill border border-mdt-border-strong bg-mdt-surface-raised px-mdt-3 py-mdt-2 text-sm font-medium text-mdt-muted shadow-mdt-sm md:flex">
                  {user.image && (
                    <Image
                      src={user.image}
                      alt={user.name ?? "avatar"}
                      width={28}
                      height={28}
                      className="shrink-0 rounded-full"
                    />
                  )}
                  <span
                    className="hidden max-w-[180px] min-w-0 truncate whitespace-nowrap text-mdt-text md:inline"
                    title={user.username ?? user.name ?? user.email ?? "Signed in"}
                  >
                    {user.username ?? user.name ?? user.email ?? "Signed in"}
                  </span>
                  <form action="/api/auth/signout" method="post">
                    <Button variant="ghost" size="xs" type="submit">
                      Sign out
                    </Button>
                  </form>
                </div>
              ) : (
                <div className="hidden items-center gap-2 md:flex">
                  <Button variant="ghost" size="xs" className="whitespace-nowrap" asChild>
                    <Link
                      href={`/signin?callbackUrl=${encodeURIComponent(pathname || "/")}`}
                      onClick={() => {
                        track("nav_click", { href: "signin", placement: "desktop" });
                        emitCityWordmarkEvent({ type: "login", method: "oauth" });
                      }}
                    >
                      Sign in
                    </Link>
                  </Button>
                  <Button size="xs" className="whitespace-nowrap" asChild>
                    <Link
                      href={ctaHref}
                      onClick={() => {
                        track("nav_click", { href: ctaHref, cta: "scan_folder", placement: "desktop" });
                        emitCityWordmarkEvent({ type: "upload", kind: "file" });
                      }}
                    >
                      Scan a folder
                    </Link>
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 md:hidden">
              <button
                type="button"
                className={cn(
                  "flex h-mdt-11 w-mdt-11 items-center justify-center rounded-mdt-md border border-mdt-border-strong bg-mdt-surface-raised text-mdt-muted shadow-mdt-sm hover:bg-mdt-surface-subtle hover:text-mdt-text",
                  interactiveBase,
                  focusRing
                )}
                onClick={() => {
                  openMobileSearch("mobile_top");
                }}
                aria-label="Search"
                aria-expanded={showMobileSearch}
                aria-keyshortcuts="/"
              >
                <SearchIcon width={18} height={18} />
              </button>
              <button
                type="button"
                className={cn(
                  "flex h-mdt-11 w-mdt-11 items-center justify-center rounded-mdt-md border border-mdt-border-strong bg-mdt-surface-raised text-mdt-muted shadow-mdt-sm hover:bg-mdt-surface-subtle hover:text-mdt-text",
                  interactiveBase,
                  focusRing
                )}
                aria-label="Open menu"
                onClick={(e) => openOverflowMenu(e.currentTarget)}
              >
                <MenuIcon width={18} height={18} />
              </button>
            </div>
          </div>
        </Container>
      </header>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-mdt-border-strong bg-mdt-surface-raised px-3 py-3 text-caption font-medium text-mdt-muted shadow-mdt-lg backdrop-blur-md md:hidden"
        role="navigation"
        aria-label="Primary"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 10px)" }}
      >
        {bottomNavItems.map((item) => {
          const active = item.type === "link" ? isActive(item.href ?? "") : false;
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex-1">
              {item.type === "link" ? (
                <Link
                  href={item.href!}
                  className={`group flex h-14 min-h-[56px] flex-col items-center justify-center gap-1 rounded-mdt-md px-mdt-2 transition duration-mdt-fast ease-mdt-standard ${
                    active ? "bg-mdt-surface-strong text-mdt-text" : "hover:bg-mdt-surface-subtle hover:text-mdt-text"
                  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mdt-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--mdt-color-surface)]`}
                  onClick={() => track("nav_click", { href: item.href, placement: "bottom" })}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="flex h-6 w-6 items-center justify-center" aria-hidden>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-[12px] leading-tight">{item.label}</span>
                  {active && <span className="mt-1 h-1 w-8 rounded-full bg-mdt-primary" aria-hidden />}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    openMobileSearch("bottom_nav");
                  }}
                  className="flex h-14 min-h-[56px] w-full flex-col items-center justify-center gap-1 rounded-mdt-md px-mdt-2 text-mdt-text transition duration-mdt-fast ease-mdt-standard hover:bg-mdt-surface-subtle hover:text-mdt-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mdt-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--mdt-color-surface)]"
                  aria-label="Open search"
                  aria-keyshortcuts="/"
                >
                  <span className="flex h-6 w-6 items-center justify-center" aria-hidden>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-[12px] leading-tight">{item.label}</span>
                </button>
              )}
            </div>
          );
        })}
      </nav>

      <Sheet open={showMobileSearch} onOpenChange={(open) => setShowMobileSearch(open)}>
        <SheetContent
          side="top"
          className="md:hidden rounded-b-2xl bg-mdt-surface-raised p-mdt-5"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const shouldSuppress = suppressMobileSearchRestoreRef.current;
            suppressMobileSearchRestoreRef.current = false;
            if (!shouldSuppress) {
              mobileSearchReturnFocusRef.current?.focus();
            }
          }}
        >
          <SheetTitle className="sr-only">Search</SheetTitle>
          <div className="flex items-center justify-between mb-mdt-3">
            <p className="text-sm font-semibold text-mdt-text">Search</p>
            <SheetClose asChild>
              <button className="text-sm text-mdt-muted hover:text-mdt-text" aria-label="Close search">
                Close
              </button>
            </SheetClose>
          </div>
          <form
            role="search"
            onSubmit={onSearch}
            className="flex flex-col gap-mdt-3 rounded-mdt-lg border border-mdt-border-strong bg-mdt-surface px-mdt-4 py-mdt-3 text-body-sm shadow-mdt-sm"
          >
            <input
              ref={inputRef}
              className="w-full bg-transparent text-mdt-text outline-none placeholder:text-mdt-muted"
              placeholder="Search snippets, templates…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search"
              aria-keyshortcuts="/"
            />
            <div className="flex items-center justify-end">
              <Button type="submit" size="sm">
                Search
              </Button>
            </div>
          </form>

          <div className="mt-mdt-3 space-y-2">
            <p className="text-caption font-semibold text-mdt-muted">Quick filters</p>
            <div className="flex flex-wrap gap-2">
              {quickFilters.map((filter) => (
                <Button
                  key={filter.label}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-mdt-pill"
                  onClick={() => applyQuickFilter(filter.params, "mobile_search_filter")}
                >
                  {filter.label}
                </Button>
              ))}
              <SheetClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-mdt-pill"
                  onClick={() => {
                    suppressMobileSearchRestoreRef.current = true;
                    openCommandPalette("mobile_search_sheet");
                  }}
                >
                  Command palette
                </Button>
              </SheetClose>
            </div>
          </div>

          {recentSearches.length > 0 && (
            <div className="mt-mdt-3 space-y-2">
              <div>
                <p className="text-caption font-semibold text-mdt-muted">Recent</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      type="button"
                      className="rounded-mdt-md border border-mdt-border px-mdt-3 py-mdt-2 text-body-sm text-mdt-text hover:bg-mdt-surface-subtle"
                      onClick={() => {
                        setQuery(term);
                        requestAnimationFrame(() => inputRef.current?.focus());
                        track("nav_search_suggestion_click", { term, source: "recent" });
                      }}
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={showOverflowSheet} onOpenChange={(open) => setShowOverflowSheet(open)}>
        <SheetContent
          side="bottom"
          className="md:hidden rounded-t-2xl bg-mdt-surface-raised p-mdt-5"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const shouldSuppress = suppressOverflowRestoreRef.current;
            suppressOverflowRestoreRef.current = false;
            if (!shouldSuppress) {
              overflowReturnFocusRef.current?.focus();
            }
          }}
        >
          <SheetTitle className="sr-only">More</SheetTitle>
          <div className="mb-mdt-3 flex items-center justify-between">
            <div className="h-1.5 w-12 rounded-full bg-mdt-border" aria-hidden />
            <SheetClose asChild>
              <button type="button" className="text-sm text-mdt-muted hover:text-mdt-text" aria-expanded={showOverflowSheet}>
                Close
              </button>
            </SheetClose>
          </div>
          <div className="mb-mdt-4 flex flex-wrap gap-mdt-2">
            <SheetClose asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  suppressOverflowRestoreRef.current = true;
                  openCommandPalette("mobile_overflow");
                }}
              >
                Command palette
              </Button>
            </SheetClose>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => openMobileSearch("overflow", overflowReturnFocusRef.current)}
            >
              Search
            </Button>
            <DensityToggle />
          </div>
          <div className="grid grid-cols-2 gap-mdt-3">
            {overflowLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noreferrer" : undefined}
                className="rounded-mdt-lg border border-mdt-border-strong bg-mdt-surface px-mdt-3 py-mdt-2 text-body-sm font-semibold text-mdt-text shadow-mdt-sm transition duration-mdt-fast ease-mdt-standard hover:bg-mdt-surface-subtle hover:shadow-mdt-md"
                onClick={() => {
                  setShowOverflowSheet(false);
                  track("nav_click", { href: link.href, placement: "overflow" });
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
