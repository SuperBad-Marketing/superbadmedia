export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth/session";
import { generateBrandPackContent } from "@/lib/brand-dna/brand-pack/generate";
import { buildBrandPackHtml } from "@/lib/brand-dna/brand-pack/template";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ profileId: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return new Response("unauthorized", { status: 401 });
  }

  const { profileId } = await params;

  const profile = await db
    .select()
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.id, profileId))
    .get();

  if (!profile) {
    return new Response("profile not found", { status: 404 });
  }

  try {
    const data = await generateBrandPackContent(profileId, null);
    const html = buildBrandPackHtml(data);

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "generation failed";
    return new Response(message, { status: 500 });
  }
}
