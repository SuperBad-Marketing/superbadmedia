import type { Metadata } from "next";

import { allFontVariables } from "@/lib/fonts";
import { getActivePresets } from "@/lib/presets";

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
  const { htmlClassNames } = await getActivePresets();

  return (
    <html
      lang="en"
      className={`${htmlClassNames} ${allFontVariables} h-full antialiased`}
    >
      <body className="bg-background text-foreground min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
