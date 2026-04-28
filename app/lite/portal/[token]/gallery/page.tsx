import { requirePortalSession } from "@/lib/portal/require-session";
import { PortalGallery } from "@/components/lite/portal/gallery";
import { fetchGalleryItems } from "./actions";

export default async function PortalGalleryPage() {
  await requirePortalSession();

  const { items, archives, hasMore } = await fetchGalleryItems();

  return <PortalGallery items={items} archives={archives} hasMore={hasMore} />;
}
