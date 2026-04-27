import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";

import { allFontVariables } from "@/lib/fonts";
import { getActivePresets } from "@/lib/presets";
import { MotionProvider } from "@/components/lite/motion-provider";
import { SoundProvider } from "@/components/lite/sound-provider";
import { ThemeProvider } from "@/components/lite/theme-provider";
import { ReportIssueButton } from "@/components/lite/report-issue-button";
import { NoTricksLink } from "@/components/lite/no-tricks-link";
import { PublicEggShell } from "@/components/lite/public-egg-shell";
import { PostHogAnalyticsProvider } from "@/components/lite/posthog-provider";
import { getPosthogConfig } from "@/lib/integrations/posthog-config";

import "./globals.css";

export const metadata: Metadata = {
  title: "SuperBad",
  description: "SuperBad operations platform.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SuperBad",
  },
};

export const viewport: Viewport = {
  themeColor: "#1A1A18",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [{ htmlClassNames, theme, typeface, motion, density, textSize, soundsEnabled }, posthog] =
    await Promise.all([getActivePresets(), getPosthogConfig()]);

  return (
    <html
      lang="en"
      className={`${htmlClassNames} ${allFontVariables} h-full antialiased`}
    >
      <body className="bg-background text-foreground min-h-full flex flex-col">
        <ThemeProvider value={{ theme, typeface, motion, density, textSize, soundsEnabled }}>
          <MotionProvider>
            <SoundProvider>
              <PostHogAnalyticsProvider posthogKey={posthog.key} posthogHost={posthog.host}>
                {children}
              </PostHogAnalyticsProvider>
              <PublicEggShell />
              <Toaster />
              <footer className="mt-auto flex items-center justify-between px-4 pb-3 pt-2">
                <NoTricksLink />
                <ReportIssueButton />
              </footer>
            </SoundProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
