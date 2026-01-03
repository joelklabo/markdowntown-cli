import type { Metadata } from "next";
import Script from "next/script";
import { cookies } from "next/headers";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { PosthogProviderLazy } from "@/providers/PosthogProviderLazy";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { DensityProvider } from "@/providers/DensityProvider";
import { getSession } from "@/lib/auth";
import { featureFlags } from "@/lib/flags";
import { SiteNav } from "@/components/SiteNav";
import { Footer } from "@/components/Footer";
import { PerfVitalsToggle } from "@/components/PerfVitalsToggle";
import { CommandPalette } from "@/components/CommandPalette";
import { WhatNewBanner } from "@/components/WhatNewBanner";
import { UxTelemetry } from "@/components/UxTelemetry";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-inter",
});

const display = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-display",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://markdown.town"),
  title: "mark downtown",
  description: "Compose, remix, and preview reusable markdown sections for your AI agents.",
  keywords: [
    "markdown",
    "prompts",
    "AI",
    "Next.js",
    "prompt library",
    "prompt composer",
    "sections",
  ],
  openGraph: {
    title: "mark downtown",
    description: "Compose, remix, and preview reusable markdown sections for your AI agents.",
    url: "https://markdown.town",
    siteName: "mark downtown",
    images: [
      {
        url: "/markdown-town-icon.svg",
        width: 256,
        height: 256,
        alt: "mark downtown logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "mark downtown",
    description: "Compose, remix, and preview reusable markdown sections for your AI agents.",
    images: ["/markdown-town-icon.svg"],
  },
  icons: {
    icon: "/markdown-town-icon.svg",
    shortcut: "/markdown-town-icon.svg",
    apple: "/markdown-town-icon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const user = session?.user ?? null;
  const cookieStore = await cookies();
  const densityCookie = cookieStore.get("mdt_density")?.value;
  const initialDensity = densityCookie === "compact" ? "compact" : "comfortable";
  const themeCookie = cookieStore.get("mdt_theme")?.value;
  const initialTheme = themeCookie === "light" || themeCookie === "dark" ? themeCookie : null;
  const htmlClassName = [
    inter.variable,
    display.variable,
    mono.variable,
    initialTheme === "dark" ? "dark" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <html
      lang="en"
      className={htmlClassName}
      data-density={initialDensity}
      data-theme={initialTheme ?? undefined}
      data-theme-refresh={featureFlags.themeRefreshV1 ? "true" : undefined}
      data-ux-clarity={featureFlags.uxClarityV1 ? "true" : undefined}
      data-instruction-health={featureFlags.instructionHealthV1 ? "true" : undefined}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <Script
          id="density-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html:
              "try{var d=localStorage.getItem('mdt_density');if(d==='compact'||d==='comfortable'){document.documentElement.dataset.density=d;}}catch(e){}",
          }}
        />
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html:
              "try{var d=document.documentElement;var t=d.dataset.theme;if(t!=='light'&&t!=='dark'){var stored=null;try{stored=localStorage.getItem('theme');}catch(e){}if(stored!=='light'&&stored!=='dark'){var prefersDark=false;try{prefersDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;}catch(e){}stored=prefersDark?'dark':'light';}d.dataset.theme=stored;t=stored;}if(t==='dark'){d.classList.add('dark');}else{d.classList.remove('dark');}}catch(e){}",
          }}
        />
      </head>
      <body className="bg-mdt-bg text-mdt-text font-sans antialiased min-h-screen pb-20 md:pb-0">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <DensityProvider initialDensity={initialDensity}>
          <ThemeProvider initialTheme={initialTheme ?? undefined}>
            <PosthogProviderLazy>
              <UxTelemetry />
              <SiteNav user={user} />
              <WhatNewBanner />
              <CommandPalette />
              <PerfVitalsToggle />
              <main id="main-content">{children}</main>
              <Footer />
            </PosthogProviderLazy>
          </ThemeProvider>
        </DensityProvider>
      </body>
    </html>
  );
}
