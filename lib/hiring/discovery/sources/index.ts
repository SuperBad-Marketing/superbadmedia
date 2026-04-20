import type { DiscoverySource } from "../types";
import { vimeoStaffPicksSource } from "./vimeo-staff-picks";
import { behanceGallerySource } from "./behance-gallery";

export const DISCOVERY_SOURCES: DiscoverySource[] = [
  vimeoStaffPicksSource,
  behanceGallerySource,
];
