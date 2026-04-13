import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";

import { allFontVariables } from "@/lib/fonts";
import { getActivePresets } from "@/lib/presets";
import { MotionProvider } from "@/components/lite/motion-provider";
import { SoundProvider } from "@/components/lite/sound-provider";
import { ThemeProvider } from "@/components/lite/theme-provider";

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
            </SoundProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
