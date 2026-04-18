import { requirePortalSession } from "@/lib/portal/require-session";
import { PortalSectionPlaceholder } from "@/components/lite/portal/section-placeholder";

export default async function PortalGalleryPage() {
  await requirePortalSession();

  return <PortalSectionPlaceholder section="Gallery" description="your photos and video." />;
}
