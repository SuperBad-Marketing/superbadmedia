import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";

import { allFontVariables } from "@/lib/fonts";
import { getActivePresets } from "@/lib/presets";
import { MotionProvider } from "@/components/lite/motion-provider";
import { SoundProvider } from "@/components/lite/sound-provider";
import { ThemeProvider } from "@/components/lite/theme-provider";
import { ReportIssueButton } from "@/components/lite/report-issue-button";

import "./globals.css";

export const metadata: Metadata = {
  title: "SuperBad",
  description: "SuperBad operations platform.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { htmlClassNames, theme, typeface } = await getActivePresets();

  return (
    <html
      lang="en"
      className={`${htmlClassNames} ${allFontVariables} h-full antialiased`}
    >
      <body className="bg-background text-foreground min-h-full flex flex-col">
        <ThemeProvider value={{ theme, typeface }}>
          <MotionProvider>
            <SoundProvider>
              {children}
              <Toaster />
              <footer className="mt-auto flex justify-end px-4 pb-3 pt-2">
                <ReportIssueButton />
              </footer>
            </SoundProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
