export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { outreachSends } from "@/lib/db/schema/outreach-sends";
import { verifyClickToken } from "@/lib/lead-gen/click-token";
import { settingsRegistry } from "@/lib/settings";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t");
  if (!token) {
    return new NextResponse("Missing token", { status: 400 });
  }

  const result = verifyClickToken(token);
  if (!result.valid) {
    return new NextResponse("Invalid token", { status: 403 });
  }

  const { send_id, url } = result.payload;

  // Record click on outreach_sends (non-blocking)
  db.update(outreachSends)
    .set({
      first_clicked_at: sql`COALESCE(${outreachSends.first_clicked_at}, ${Date.now()})`,
      click_count: sql`${outreachSends.click_count} + 1`,
    })
    .where(eq(outreachSends.id, send_id))
    .run();

  const [metaPixelId, googleConversionId] = await Promise.all([
    settingsRegistry.get("retargeting.meta_pixel_id"),
    settingsRegistry.get("retargeting.google_conversion_id"),
  ]);

  const metaSnippet =
    metaPixelId
      ? `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${escapeJs(metaPixelId)}');fbq('track','Lead');`
      : "";

  const googleSnippet =
    googleConversionId
      ? `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${escapeJs(googleConversionId)}');gtag('event','conversion',{'send_to':'${escapeJs(googleConversionId)}'});`
      : "";

  const googleScriptTag =
    googleConversionId
      ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${escapeHtml(googleConversionId)}"></script>`
      : "";

  const safeUrl = escapeHtml(url);

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
${googleScriptTag}
<script>${metaSnippet}${googleSnippet}setTimeout(function(){window.location.href="${escapeJs(url)}"},0);</script>
<noscript><meta http-equiv="refresh" content="0;url=${safeUrl}"></noscript>
</head><body></body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeJs(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/</g, "\\x3c")
    .replace(/>/g, "\\x3e");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
